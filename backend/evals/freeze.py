"""Preserve a source-only baseline without secrets, databases or runtime traces."""
import argparse
import sys
from importlib.metadata import distributions
import hashlib
import json
import subprocess
import zipfile
from datetime import datetime
from pathlib import Path

REPO=Path(__file__).resolve().parents[2]

def main():
    p=argparse.ArgumentParser();p.add_argument('version');args=p.parse_args()
    if not args.version.isalnum(): p.error('Use a simple version label, such as v1')
    target=REPO/'docs'/'baselines'/args.version
    target.mkdir(parents=True,exist_ok=False)  # do not overwrite a historical baseline
    paths=set(subprocess.check_output(['git','ls-files'],cwd=REPO,text=True).splitlines())
    for root in ['backend/agent','backend/evals','backend/knowledge','backend/tests','docs','frontend/src','frontend/tests']:
        paths.update(str(f.relative_to(REPO)) for f in (REPO/root).rglob('*') if f.is_file() and f.suffix in ['.py','.md','.json','.jsx','.js'])
    paths.update(['backend/conftest.py','backend/.env.example','AGENT_ARCHITECTURE_PROPOSAL.md'])
    excluded=['node_modules','__pycache__','runs','baselines','test-results']
    paths=sorted(name for name in paths if (REPO/name).is_file() and not any(part in excluded for part in Path(name).parts) and Path(name).name!='.env' and not name.endswith(('.db','.sqlite','.sqlite3','.pyc')))
    hashes={name:hashlib.sha256((REPO/name).read_bytes()).hexdigest() for name in paths}
    archive=target/'source.zip'
    with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
        for name in paths: z.write(REPO/name,name)
    manifest={'version':args.version,'created_at':datetime.utcnow().isoformat(),'git_base':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),
              'python_version':sys.version.split()[0],
              'python_packages':{d.metadata['Name']:d.version for d in distributions() if d.metadata.get('Name')},
              'description':'Working source snapshot, including uncommitted V1 implementation; no live model-quality claim.',
              'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':hashes}
    (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(f'Preserved {len(paths)} source files in {target}')

if __name__=='__main__': main()
