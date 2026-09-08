from pathlib import Path

# Health bridge contract
p = Path("quan-ly-hoc-tap/app/health-bridge.server.ts")
text = p.read_text()
old = '''  controlProtocol?: "health-control-plane";
  contractVersion: number;
  capabilities?: readonly string[];'''
new = '''  controlProtocol?: "health-control-plane";
  contractVersion: number;
  buildRevision?: string | null;
  buildSource?: string | null;
  capabilities?: readonly string[];'''
if old not in text:
    raise SystemExit("HealthApplicationProbe revision insertion point not found")
p.write_text(text.replace(old, new, 1))

# Center bootstrap runtime projection
p = Path("quan-ly-hoc-tap/app/api/center/route.ts")
text = p.read_text()
old = '''        contractVersion: health.contractVersion,
        canonicalApplication: health.canonicalApplication ?? null,
        capabilities: healthCapabilities,'''
new = '''        contractVersion: health.contractVersion,
        canonicalApplication: health.canonicalApplication ?? null,
        buildRevision: health.buildRevision ?? null,
        buildSource: health.buildSource ?? null,
        capabilities: healthCapabilities,'''
if old not in text:
    raise SystemExit("center runtime revision insertion point not found")
p.write_text(text.replace(old, new, 1))

# Client runtime type
p = Path("quan-ly-hoc-tap/app/admin-device-client.ts")
text = p.read_text()
old = '''    contractVersion?: number;
    canonicalApplication?: string | null;
    capabilities?: readonly string[];'''
new = '''    contractVersion?: number;
    canonicalApplication?: string | null;
    buildRevision?: string | null;
    buildSource?: string | null;
    capabilities?: readonly string[];'''
if old not in text:
    raise SystemExit("client runtime revision insertion point not found")
p.write_text(text.replace(old, new, 1))

# Application card display
p = Path("quan-ly-hoc-tap/app/application-hub.tsx")
text = p.read_text()
old = '''                  {application.runtime.contractVersion
                    ? <small>Contract v{application.runtime.contractVersion} · {application.runtime.canonicalApplication || "alias legacy"}</small>
                    : null}
                </div>'''
new = '''                  {application.runtime.contractVersion
                    ? <small>Contract v{application.runtime.contractVersion} · {application.runtime.canonicalApplication || "alias legacy"}</small>
                    : null}
                  {application.runtime.buildRevision
                    ? <small>Revision {application.runtime.buildRevision.slice(0, 12)} · {application.runtime.buildSource || "Health_Care"}</small>
                    : <small>Revision production: chưa công bố</small>}
                </div>'''
if old not in text:
    raise SystemExit("application card revision insertion point not found")
p.write_text(text.replace(old, new, 1))
