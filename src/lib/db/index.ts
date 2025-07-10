/**
 * @fileoverview Database service layer.
 * This file reads the DATABASE_PROVIDER environment variable and exports the appropriate
 * database client. This allows for seamless switching between different database
 * backends (e.g., SQLite for local development, Firestore for production).
 */
import * as sqlite from './sqlite';
// import * as firestore from './firestore'; // Example for future implementation

const getDbClient = () => {
  const provider = process.env.DATABASE_PROVIDER;

  if (provider === 'sqlite') {
    return sqlite;
  }
  
  // Future implementation for Firestore
  // if (provider === 'firestore') {
  //   return firestore;
  // }

  // Default to SQLite if no provider is specified or provider is invalid
  if (provider) {
    console.warn(`Invalid DATABASE_PROVIDER "${provider}". Defaulting to 'sqlite'.`);
  } else {
    console.warn(`DATABASE_PROVIDER is not set. Defaulting to 'sqlite'.`);
  }
  return sqlite;
};

export const db = getDbClient();
