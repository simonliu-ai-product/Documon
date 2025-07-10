# Documon
Documon - Your AI-Powered Document Annotation &amp; Evaluation Assistant

## 主要功能

*   **PDF 內容提取**: 上傳 PDF 檔案，系統會自動提取其中的文字內容。
*   **AI 生成問答**:
    *   **問答題 (Open-ended)**: 根據文件內容，生成開放式的問題和對應的答案。
    *   **單一選擇題 (Multiple-choice)**: 生成包含四個選項的單一選擇題，其中一個為正確答案。
*   **模型競技場 (Arena)**: 對兩個不同的 AI 模型進行並排比較，評估它們在相同任務上的表現。
*   **手動編輯與確認**: 您可以對 AI 生成的結果進行編輯、確認，並將其加入到您的標註資料中。
*   **資料匯出**: 將確認後的標註資料匯出為 CSV 格式，方便後續使用。

## 技術棧

*   **前端**: [Next.js](https://nextjs.org/) (with [React](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/))
*   **UI 元件**: [shadcn/ui](https://ui.shadcn.com/)
*   **後端 AI 框架**: [Genkit](https://firebase.google.com/docs/genkit)
*   **AI 模型**: [Google AI](https://ai.google/) and [OpenAI](https://openai.com/)
*   **PDF 解析**: [pdf.js](https://mozilla.github.io/pdf.js/)
*   **資料庫**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

## 如何開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 執行開發伺服器

```bash
npm run dev
```

然後在瀏覽器中打開 `http://localhost:9002`。

### 3. 執行正式環境

首先，建立正式版本的應用程式：

```bash
npm run build
```

然後，啟動正式伺服器：

```bash
npm run start
```

### 4. 使用 Docker

您也可以使用 Docker 來建立並執行應用程式。

首先，建立 Docker 映像檔：

```bash
docker build -t documon .
```

然後，執行 Docker 容器：

```bash
docker run -p 3000:3000 documon
```

這將會在 `http://localhost:3000` 啟動應用程式。

#### 使用 Docker Compose

如果您想使用 Docker Compose 來管理多個服務（例如，應用程式和資料庫管理工具），請確保您已經創建了 `docker-compose.yaml` 文件。

啟動所有服務（在後台運行）：

```bash
docker-compose up -d
```

這將啟動 Documon 應用程式（通常在 `http://localhost:3000`）和 `sqliteweb` 服務（通常在 `http://localhost:3001`）。

停止並移除所有服務：

```bash
docker-compose down
```

## 5. 主要流程 (AI Flows)

### `suggest-annotations.ts`

這個流程負責從文件中生成問答標註。它可以根據您的選擇，生成問答題或單一選擇題。

### `arena-flow.ts`

這個流程用於執行模型競技場。它會使用兩個不同的 AI 模型，針對相同的問題生成答案，讓您可以並排比較它們的表現。

## 4. 授權

本專案採用 [GNU General Public License v2.0](LICENSE) 授權。詳情請參閱 [LICENSE](LICENSE) 檔案。