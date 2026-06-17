# Some of them require plugins

## Example: OpenCode

`~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@devtheops/opencode-plugin-otel"]
}
```

The plugin npm package must be installed in `~/.config/opencode/node_modules/` for opencode to pick it up:

```bash
cd ~/.config/opencode && npm install @devtheops/opencode-plugin-otel
```

### Environment variables

```bash
export OPENCODE_ENABLE_TELEMETRY=1
export OPENCODE_OTLP_ENDPOINT=http://<your-otel-collector>:4318
export OPENCODE_OTLP_PROTOCOL=http/protobuf
export OPENCODE_OTLP_METRICS_INTERVAL=30000
export OPENCODE_OTLP_LOGS_INTERVAL=1000
```

Note:
With OpenCode, it was a bit more tricky. I ended up using an external plugin - but the setup itself was fairly straightforward afterwards. It was similar for OpenClaw too. You also use a set of environment variables, they have an OpenCode prefix, everything just works.