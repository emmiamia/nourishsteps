import { useEffect, useState } from 'react';
import { listResources } from '../api';
import { SkeletonList } from '../components/Skeleton';

export default function Resources(){
  const [items, setItems] = useState(null);
  useEffect(()=>{ listResources().then(setItems); },[]);
  return (
    <div className="grid gap-4">
      <h2 className="text-2xl font-medium">Resources</h2>
      {!items ? (
        <SkeletonList count={5} />
      ) : (
        <div className="grid gap-3">
          {items.map(r=> (
          <a key={r.id} href={r.url} target="_blank" className={`card p-4 border ${r.type==='crisis'?'border-error':'border-base-300'}`} rel="noreferrer">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="text-xs opacity-70">{r.type} · {r.tags}</div>
              </div>
              <span className="btn btn-sm">Open</span>
            </div>
          </a>
          ))}
        </div>
      )}
    </div>
  );
}
