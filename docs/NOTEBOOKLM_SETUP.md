# NotebookLM Setup

VideoLM uses [`notebooklm-mcp-cli`](https://github.com/jacob-bd/notebooklm-mcp-cli) to automate NotebookLM operations. The CLI stores browser login cookies locally, and VideoLM can use those cookies to list notebooks, add sources, trigger NotebookLM video generation, and download finished artifacts.

This guide uses the upstream `nlm` command as documented by the project.

## Install `uv`

If `uv` is not installed:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Restart the shell or source your shell config if `uv` is not found immediately.

## Install the NotebookLM CLI

```bash
uv tool install notebooklm-mcp-cli
```

Verify:

```bash
nlm --help
```

## Log In

Run:

```bash
nlm login
```

The CLI opens a browser login flow. Sign in with the Google account that has access to NotebookLM and any Google Labs features required for video generation.

Check the session:

```bash
nlm login --check
```

Run diagnostics:

```bash
nlm doctor
```

## Cookie Location

The default profile stores cookies here:

```text
~/.notebooklm-mcp-cli/profiles/default/cookies.json
```

On the EC2 deployment, Docker Compose mounts:

```text
${NLM_HOME:-$HOME/.notebooklm-mcp-cli}:/root/.notebooklm-mcp-cli
```

For the Ubuntu production VM, set:

```bash
NLM_HOME=/home/ubuntu/.notebooklm-mcp-cli
```

## Server-Side Default Profile

On the VM:

```bash
uv tool install notebooklm-mcp-cli
nlm login
nlm login --check
nlm doctor
```

Confirm the cookies file exists:

```bash
ls -l ~/.notebooklm-mcp-cli/profiles/default/cookies.json
```

Then restart the app container:

```bash
docker compose restart videolm
```

## User-Provided Profile Through The UI

The Research Lab supports bring-your-own NotebookLM credentials:

1. The user installs the CLI on their own computer.
2. The user runs `nlm login`.
3. The user checks the session with `nlm login --check`.
4. The user opens or copies:

   ```text
   ~/.notebooklm-mcp-cli/profiles/default/cookies.json
   ```

5. The user pastes the JSON or uploads the file in the Research Lab profile panel.
6. VideoLM saves it under the selected profile id.

This allows the app to use the notebooks, sources, and quotas available to that user account.

## Named Profiles

The UI accepts a `profileId`. Use simple identifiers:

```text
default
reviewer
demo-account
```

Do not use email addresses or secrets as profile ids.

## Research Lab Capabilities

With a valid profile, the app can:

- list NotebookLM notebooks
- list notebook sources
- use an existing notebook
- upload source files to a notebook
- add URL sources
- trigger a NotebookLM video overview
- poll for completed downloads

Supported upload source types in the UI:

```text
txt
md
pdf
doc
docx
ppt
pptx
csv
xls
xlsx
```

## Troubleshooting

### `nlm` command not found

Make sure `uv tool` binaries are on `PATH`. Restart the terminal after installing `uv`, then run:

```bash
uv tool list
```

### Login succeeds locally but not in Docker

Check the mounted path:

```bash
echo "$NLM_HOME"
ls -l "$NLM_HOME/profiles/default/cookies.json"
docker compose exec videolm ls -l /root/.notebooklm-mcp-cli/profiles/default/cookies.json
```

### Notebook list fails

Run:

```bash
nlm login --check
nlm doctor
```

If the local check fails, log in again:

```bash
nlm login
```

### Cookies expire

Google sessions can expire or be invalidated. Re-run `nlm login` and upload or mount the updated `cookies.json`.

## Security Notes

`cookies.json` is account access material. Treat it like a password.

- Do not commit it.
- Do not paste it into public logs.
- Do not share it with reviewers unless that is intentional.
- Use a dedicated Google account for demos when possible.
