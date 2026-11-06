#!/usr/bin/env python3
"""Export versioned Git only; never copies credentials, user data or the host filesystem."""
import argparse, hashlib, json, pathlib, subprocess, tempfile, zipfile

def git(root,*args):
    return subprocess.check_output(['git','-C',str(root),*args],text=True).strip()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('output',help='New output directory outside the repository')
    options=parser.parse_args()
    root=pathlib.Path(git(pathlib.Path.cwd(),'rev-parse','--show-toplevel')).resolve()
    out=pathlib.Path(options.output).resolve()
    if out==root or root in out.parents or out.exists():
        raise SystemExit('Use a new directory outside the checkout; never overwrite a backup.')
    if git(root,'status','--porcelain'):
        raise SystemExit('Commit/review tracked and untracked changes before exporting.')
    out.mkdir(parents=True)
    with tempfile.TemporaryDirectory(prefix='benger-portable-') as temporary:
        bare=pathlib.Path(temporary)/'source.git'
        subprocess.run(['git','init','--bare','--initial-branch=main',str(bare)],check=True,capture_output=True)
        refs=git(root,'for-each-ref','--format=%(refname)','refs/remotes/origin/','refs/heads/','refs/tags/').splitlines()
        mapping={}
        # Remote branches first; local branches are preserved under their own names.
        for ref in refs:
            if ref.endswith('/HEAD') or ref.startswith('refs/remotes/origin/backup-downloads-') or ref.startswith('refs/heads/backup-downloads-'):
                continue  # Packaging branches are excluded to prevent recursive ZIP growth.
            if ref.startswith('refs/remotes/origin/'):
                dest='refs/heads/'+ref.removeprefix('refs/remotes/origin/')
            elif ref.startswith(('refs/heads/','refs/tags/')):
                dest=ref
            else:
                continue
            if dest in mapping and git(root,'rev-parse',mapping[dest])!=git(root,'rev-parse',ref):
                raise SystemExit('Conflicting local/remote branch; review before backup: '+dest)
            mapping[dest]=ref
        subprocess.run(['git','-C',str(bare),'fetch','--no-tags',str(root),*[f'{src}:{dest}' for dest,src in mapping.items()]],check=True,capture_output=True)
        bundle=out/'Benger-all-branches.bundle'
        subprocess.run(['git','-C',str(bare),'bundle','create',str(bundle),'--all'],check=True,capture_output=True)
        subprocess.run(['git','-C',str(bare),'bundle','verify',str(bundle)],check=True,capture_output=True)
        restored=pathlib.Path(temporary)/'restored.git'
        subprocess.run(['git','clone','--mirror',str(bundle),str(restored)],check=True,capture_output=True)
        subprocess.run(['git','-C',str(restored),'fsck','--full'],check=True,capture_output=True)
        expected=git(bare,'for-each-ref','--format=%(refname) %(objectname)').splitlines()
        if expected!=git(restored,'for-each-ref','--format=%(refname) %(objectname)').splitlines():
            raise SystemExit('Restored refs mismatch')
        for branch,name in [('main','Benger-main-source.tar.gz'),('feature/android-apk','Benger-android-source.tar.gz')]:
            subprocess.run(['git','-C',str(bare),'archive','--format=tar.gz','--output='+str(out/name),branch],check=True)
        for source in ['docs/recovery-status-2026-11-06.md','docs/portable-environment.md']:
            (out/pathlib.Path(source).name).write_text((root/source).read_text())
        manifest={'repository':'Benger','createdAt':subprocess.check_output(['date','-u','+%Y-%m-%dT%H:%M:%SZ'],text=True).strip(),'backupCommit':git(root,'rev-parse','HEAD'),'references':expected,'verifiedRestore':True,'excludes':['signing private keys','passwords/tokens','phone data','uncommitted/lost code','installed SDKs/node_modules'],'files':{}}
        for path in sorted(out.iterdir()):
            manifest['files'][path.name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    archive=out.with_suffix('.zip')
    if archive.exists():
        raise SystemExit('Archive already exists; refusing overwrite')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as target:
        for path in sorted(out.iterdir()):
            target.write(path,arcname=path.name)
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
    print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size,'sha256':digest,'references':len(manifest['references']),'verifiedRestore':True},indent=2))

if __name__=='__main__':
    main()
