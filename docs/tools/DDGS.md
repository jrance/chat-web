# DuckDuckGo Search (`tool:ddgs.search`)

The DuckDuckGo Search tool exposes the same configuration surface as the engine-side `tool:ddgs.search` implementation. It requires no API keys and runs entirely inside the orchestration engine, making it ideal for demos and OSS agents.

## Parameters

| Name | Type | Default | Scope | Description |
| ---- | ---- | ------- | ----- | ----------- |
| `query` | string | `""` | AgentOverride | Search query text. |
| `vertical` | enum (`web`, `news`, `wikipedia`) | `web` | AgentOverride | DuckDuckGo vertical to target. `wikipedia` rewrites to `site:wikipedia.org`. |
| `maxResults` | number (1–50) | `5` | AgentOverride | Maximum number of results returned by the engine. |
| `safesearch` | enum (`off`, `moderate`, `strict`) | `moderate` | AgentOverride | Content filtering strength. |
| `region` | enum (`us-en`, `uk-en`, `wt-wt`, `de-de`, `fr-fr`, `es-es`, `it-it`, `nl-nl`, `in-en`, `jp-jp`) | `us-en` | OrgLocked | Regional preference code for ranking and language. |
| `timeLimit` | enum (`""`, `d`, `w`, `m`, `y`) | `""` | AgentOverride | Recency filter: day, week, month, year. Empty string disables the filter. |
| `siteFilter` | string[] | `[]` | AgentOverride | Restrict results to these hostnames (e.g. `["reuters.com", "apnews.com"]`). |
| `mustInclude` | string[] | `[]` | AgentOverride | Drop results that do not contain these terms in the title or snippet. |

### Example Defaults

**News Agent**

```json
{
  "vertical": "news",
  "timeLimit": "d",
  "siteFilter": ["reuters.com", "apnews.com", "bbc.com"]
}
```

**Wikipedia Agent**

```json
{
  "vertical": "wikipedia"
}
```

## Region & Timelimit Notes

- Region codes mirror DuckDuckGo's documented `region` parameter. Use `wt-wt` for a neutral, world-wide blend.
- `timeLimit` translates to the engine's `timelimit` argument (`d`=day, `w`=week, `m`=month, `y`=year). Setting the empty string disables freshness filtering.

## Engine Behavior

The UI invokes the orchestration engine with these parameters. The engine is responsible for:

- Mapping `siteFilter` to a `site:` query rewrite (`site:a.com OR site:b.com`).
- Applying `mustInclude` as a client-side snippet filter.
- Calling the keyless [ddgs](https://github.com/deedy5/ddgs) client and streaming the normalized result set back to the agent.

Because execution stays within the engine (transport `kind: "engine"`), no additional secrets or egress policies are needed.

