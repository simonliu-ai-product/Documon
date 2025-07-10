import Database, { type Database as DB } from 'better-sqlite3';
import path from 'path';
import type { ArenaJudgment, ConfirmedAnnotation } from '@/app/types';

// Use a singleton pattern for the database connection
let db: DB | null = null;

function getDbConnection(): DB {
  if (db === null) {
    try {
      const dbPath = path.join(process.cwd(), 'documon_annotation_database.db');
      db = new Database(dbPath);
      console.log(`SQLite database connection initialized at ${dbPath}`);
      
      // Create tables if they don't exist. This runs only once per connection.
      db.exec(`
        CREATE TABLE IF NOT EXISTS annotations_open_ended (
          id TEXT PRIMARY KEY,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          keywords TEXT,
          model_name TEXT,
          operator_name TEXT,
          operator_email TEXT,
          created_at TEXT NOT NULL
        )
      `);
      console.log('`annotations_open_ended` table verified.');
      
      db.exec(`
        CREATE TABLE IF NOT EXISTS annotations_multiple_choice (
          id TEXT PRIMARY KEY,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          keywords TEXT,
          choice_a TEXT,
          choice_b TEXT,
          choice_c TEXT,
          choice_d TEXT,
          choice_answer TEXT,
          operator_name TEXT,
          operator_email TEXT,
          created_at TEXT NOT NULL
        )
      `);
      console.log('`annotations_multiple_choice` table verified.');
      
      db.exec(`
        CREATE TABLE IF NOT EXISTS arena_judgments (
          id TEXT PRIMARY KEY,
          question TEXT NOT NULL,
          answer_model_a TEXT NOT NULL,
          answer_model_b TEXT NOT NULL,
          model_a_name TEXT NOT NULL,
          model_b_name TEXT NOT NULL,
          judgment TEXT NOT NULL,
          operator_name TEXT,
          operator_email TEXT,
          created_at TEXT NOT NULL
        )
      `);
      console.log('`arena_judgments` table verified.');

    } catch (error) {
      console.error("Failed to initialize SQLite database or create tables.", error);
      throw new Error("Could not initialize database.");
    }
  }
  return db;
}

// The main function to save annotations to the database
export function saveAnnotations(
    annotations: ConfirmedAnnotation[],
    operatorName: string,
    operatorEmail: string
): { success: boolean; count?: number; error?: string } {
  let connection: DB;
  try {
    connection = getDbConnection();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during DB initialization.';
    return { success: false, error: errorMessage };
  }

  const openEndedAnnotations = annotations.filter(a => !Array.isArray(a.options) || a.options.length === 0);
  const multipleChoiceAnnotations = annotations.filter(a => Array.isArray(a.options) && a.options.length > 0);

  const insertOpenEnded = connection.prepare(
      'INSERT OR REPLACE INTO annotations_open_ended (id, question, answer, keywords, model_name, operator_name, operator_email, created_at) VALUES (@id, @question, @answer, @keywords, @model_name, @operator_name, @operator_email, @created_at)'
  );

  const insertMultipleChoice = connection.prepare(
      'INSERT OR REPLACE INTO annotations_multiple_choice (id, question, answer, keywords, choice_a, choice_b, choice_c, choice_d, choice_answer, operator_name, operator_email, created_at) VALUES (@id, @question, @answer, @keywords, @choice_a, @choice_b, @choice_c, @choice_d, @choice_answer, @operator_name, @operator_email, @created_at)'
  );

  try {
    const insertMany = connection.transaction(() => {
        const now = new Date().toISOString();

        for (const ann of openEndedAnnotations) {
            insertOpenEnded.run({
                id: ann.id.toString(),
                question: ann.annotation,
                answer: ann.text,
                keywords: ann.answerkeyword,
                model_name: ann.modelName,
                operator_name: operatorName,
                operator_email: operatorEmail,
                created_at: now,
            });
        }

        for (const ann of multipleChoiceAnnotations) {
            const options = ann.options || [];
            const answerIndex = options.indexOf(ann.text);
            const choiceAnswer = answerIndex > -1 ? String.fromCharCode(65 + answerIndex) : '';

            insertMultipleChoice.run({
                id: ann.id.toString(),
                question: ann.annotation,
                answer: ann.text,
                keywords: ann.answerkeyword,
                choice_a: options[0] || null,
                choice_b: options[1] || null,
                choice_c: options[2] || null,
                choice_d: options[3] || null,
                choice_answer: choiceAnswer,
                operator_name: operatorName,
                operator_email: operatorEmail,
                created_at: now,
            });
        }
        return annotations.length;
    });
    
    const count = insertMany();
    console.log(`Successfully saved ${count} annotations to SQLite across dedicated tables.`);
    return { success: true, count };

  } catch (error) {
    console.error('Failed to save annotations to SQLite:', error);
    db = null; // Invalidate connection on error
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred during database operation.' };
  }
}


export function saveArenaJudgments(
    judgments: ArenaJudgment[],
    operatorName: string,
    operatorEmail: string
): { success: boolean; count?: number; error?: string } {
    let connection: DB;
    try {
        connection = getDbConnection();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during DB initialization.';
        return { success: false, error: errorMessage };
    }

    const insert = connection.prepare(
        'INSERT OR REPLACE INTO arena_judgments (id, question, answer_model_a, answer_model_b, model_a_name, model_b_name, judgment, operator_name, operator_email, created_at) VALUES (@id, @question, @answer_model_a, @answer_model_b, @model_a_name, @model_b_name, @judgment, @operator_name, @operator_email, @created_at)'
    );

    try {
        const insertMany = connection.transaction((records: ArenaJudgment[]) => {
          for (const record of records) {
            insert.run({
              ...record,
              operator_name: operatorName,
              operator_email: operatorEmail,
              created_at: new Date().toISOString()
            });
          }
          return records.length;
        });
        
        const count = insertMany(judgments);
        console.log(`Successfully saved ${count} arena judgments to SQLite.`);
        return { success: true, count };

    } catch (error) {
        console.error('Failed to save arena judgments to SQLite:', error);
        db = null; // Invalidate connection on error
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'An unknown error occurred during database operation.' };
    }
}
