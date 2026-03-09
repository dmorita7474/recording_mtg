# アプリケーション要件とアーキテクチャ

## 日時
2026-03-07

## 指示内容

### アプリケーションの概要
議事録生成のWebアプリケーション。ユーザーは音声入力で議事をリアルタイムで残すことができ、議事内容を準リアルタイムで生成AIが認識して、サマリと次に議論すべき課題の提案をしてくれる。

### 要件
- ユーザーはログインしてこのシステムを使用する
- ユーザーは音声入力で議事を残すことができる
- 議事の内容を準リアルタイムにまとめて視認することができる
- ユーザーが次に議論すべき内容を提案してもらえる

### アーキテクチャの前提
- AWSを採用する
- コストが優先項目であり、サーバーレス構成を前提とする

### その他
- このリポジトリでfrontend, backend, infraの全てを管理する（モノレポ）

## 補足

### 開発パターン
複数のパターンで開発を試みる方針。最初は「simple-pattern」ブランチで最もシンプルな実装を行う。

### Simple Patternのアーキテクチャ

| 役割 | AWSサービス |
|------|------------|
| 認証 | Amazon Cognito |
| フロントエンドホスティング | S3 + CloudFront |
| 音声認識 | Amazon Transcribe Streaming |
| API | API Gateway v2 WebSocket + Lambda |
| AI要約・提案 | Amazon Bedrock (Claude Haiku) |
| データ保存 | DynamoDB |

### ディレクトリ構成
```
recording_mtg/
├── frontend/   # React + TypeScript + Vite
├── backend/    # Python 3.12 + uv + boto3 (Lambda関数)
└── infra/      # Terraform (env/dev/)
```

### チーム開発体制
- プロジェクトマネージャー: 要件指示・成果物確認
- フロントエンドエンジニア: frontend/ の設計・実装
- バックエンドエンジニア: backend/ の設計・実装
- インフラエンジニア: infra/ の設計・実装

Claude Codeのチーム機能（TeamCreate, Agent）を使って並行開発を行う。
