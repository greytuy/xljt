# 每日心灵鸡汤邮件 GitHub Action

本项目是一个 GitHub Action，旨在每天定时发送一封包含“心灵鸡汤”内容的邮件。它通过调用自定义的 AI 接口获取励志名言，并使用 SMTP 服务将邮件发送给指定的收件人。

## 功能

-   **定时任务**：通过 GitHub Action 的 cron 作业，可以配置在每天的任何特定时间自动执行。
-   **动态内容**：每次发送的邮件内容都是通过调用 AI 接口动态生成的。
-   **多收件人支持**：支持同时发送邮件给多个收件人，也兼容单收件人配置。
-   **安全配置**：所有敏感信息（如 API 密钥、邮箱密码等）都通过 GitHub Secrets 进行管理，确保安全性。
-   **调试模式**：支持DEBUG开关，可控制是否显示详细日志信息，保护敏感数据。
-   **灵活部署**：只需 Fork 本项目并配置好 Secrets，即可轻松部署。

## 如何使用

### 1. Fork 本仓库

将此项目 Fork 到您自己的 GitHub 账户下。

### 2. 在 GitHub 仓库中设置 Secrets

为了让 Action 正常工作，您需要在您的 GitHub 仓库中设置以下 Secrets。请进入 `Settings` -> `Secrets and variables` -> `Actions` 页面，并点击 `New repository secret` 添加以下 Secrets：

-   **`AI_CONFIG`**:
    一个 JSON 字符串，包含了调用 AI 服务所需的信息。

    ```json
    {"apiUrl": "https://api.deepseek.com/chat/completions", "apiKey": "YOUR_DEEPSEEK_API_KEY", "model": "deepseek-r1-0528"}
    ```

-   **`MAIL_CONFIG`**:
    一个 JSON 字符串，包含了邮件发件人服务器（SMTP）的配置。

    ```json
    {
      "host": "smtp.example.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "your-login-email@example.com",
        "pass": "YOUR_EMAIL_APP_PASSWORD"
      },
      "sender": {
        "email": "sender@example.com",
        "name": "My Awesome Project"
      }
    }
    ```
    *   `host`: 您的 SMTP 服务器地址。
    *   `port`: SMTP 服务器端口（通常 `465` 用于 SSL，`587` 用于 TLS）。
    *   `secure`: 如果端口是 `465`，此项应为 `true`；如果是 `587`，此项应为 `false`。
    *   `auth.user`: 您用于**登录**邮件服务器的邮箱地址。
    *   `auth.pass`: **重要**：这里应填写您邮箱服务商生成的**授权码 (App Password)**，而不是您的邮箱登录密码。
    *   `sender.email` (可选): 您希望在邮件中显示的**发件人邮箱地址**。如果不设置，将默认使用 `auth.user`。
    *   `sender.name` (可选): 您希望在邮件中显示的**发件人名称**。如果不设置，将默认使用发件人邮箱地址的前缀。

-   **`RECIPIENT_EMAIL`** 或 **`RECIPIENT_EMAILS`**:
    收件人的电子邮件地址。您可以选择以下两种配置方式之一：

    **单收件人配置（使用 `RECIPIENT_EMAIL`）**：
    ```
    recipient@example.com
    ```

    **多收件人配置（使用 `RECIPIENT_EMAILS`）**：
    ```
    recipient1@example.com,recipient2@example.com,recipient3@example.com
    ```

    > **注意**：
    > - 如果同时设置了 `RECIPIENT_EMAILS` 和 `RECIPIENT_EMAIL`，系统将优先使用 `RECIPIENT_EMAILS`
    > - 多个邮箱地址之间用英文逗号分隔，系统会自动去除邮箱地址前后的空格
    > - 系统会自动验证邮箱地址格式的有效性

-   **`DEBUG`** (可选):
    控制是否显示详细的调试信息。设置为 `'true'` 时会显示详细日志（包括敏感信息如邮箱地址、消息ID等），设置为 `'false'` 或不设置时只显示基本的进度信息，隐藏敏感数据。

    ```
    false
    ```

    > **安全提示**：
    > - 在生产环境中建议设置为 `'false'` 以保护敏感信息
    > - 只有在需要调试问题时才设置为 `'true'`
    > - GitHub Actions日志是公开可见的，请谨慎使用debug模式

### 3. （可选）自定义触发时间

默认情况下，工作流配置为每天早上 9 点（UTC+8）触发。如果您想修改触发时间，可以编辑 `.github/workflows/daily-email.yml` 文件中的 `cron` 表达式。

例如，要改为每天早上 7 点触发，可以将其修改为：

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '0 23 * * *' # 对应 UTC 时间 23:00，即北京时间早上 7:00
```

完成以上配置后，GitHub Action 将会按照您设定的时间自动运行。您也可以在 Actions 标签页手动触发 (`workflow_dispatch`) 以进行测试。
## 本地配置

如果您希望在本地运行此脚本进行测试，请创建一个 `.env` 文件，并配置以下环境变量。

> **注意**: 本地测试时，请将 JSON 配置写在一行，或者使用能够处理多行环境变量的工具（如 `dotenv`）。

-   **`AI_CONFIG`**:
    一个 JSON 字符串，包含了调用 AI 服务所需的信息。

    ```json
    {"apiUrl": "https://api.deepseek.com/chat/completions", "apiKey": "YOUR_DEEPSEEK_API_KEY", "model": "deepseek-r1-0528"}
    ```

-   **`MAIL_CONFIG`**:
    一个 JSON 字符串，包含了邮件发件人服务器（SMTP）的配置。

    ```json
    {
      "host": "smtp.example.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "your-login-email@example.com",
        "pass": "YOUR_EMAIL_APP_PASSWORD"
      },
      "sender": {
        "email": "sender@example.com",
        "name": "My Awesome Project"
      }
    }
    ```

-   **`RECIPIENT_EMAIL`** 或 **`RECIPIENT_EMAILS`**:
    收件人的电子邮件地址。您可以选择以下两种配置方式之一：

    **单收件人配置（使用 `RECIPIENT_EMAIL`）**：
    ```
    recipient@example.com
    ```

    **多收件人配置（使用 `RECIPIENT_EMAILS`）**：
    ```
    recipient1@example.com,recipient2@example.com,recipient3@example.com
    ```

    > **注意**：
    > - 如果同时设置了 `RECIPIENT_EMAILS` 和 `RECIPIENT_EMAIL`，系统将优先使用 `RECIPIENT_EMAILS`
    > - 多个邮箱地址之间用英文逗号分隔，系统会自动去除邮箱地址前后的空格
    > - 系统会自动验证邮箱地址格式的有效性

-   **`DEBUG`** (可选):
    控制是否显示详细的调试信息。设置为 `true` 时会显示详细日志，设置为 `false` 或不设置时只显示基本信息。

    ```
    DEBUG=false
    ```

    > **本地测试提示**：
    > - 本地测试时可以设置为 `true` 来查看详细的执行过程
    > - 生产环境建议设置为 `false` 以保护敏感信息