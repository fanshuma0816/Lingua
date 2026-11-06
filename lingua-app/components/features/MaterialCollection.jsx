"use client";

import { useUI } from "../../hooks/useUI";
import { deleteMaterial } from "../../lib/materials-client";
import { materialStatus } from "../../lib/material-plan";

function MaterialCollection({materials,auth,onStartSegment,onDeleted}){
  const {t}=useUI(),token=auth?.session?.accessToken;
  async function remove(item){if(!confirm(t.deleteMaterialConfirm||"Delete this saved material and its remaining lesson plan?"))return;await deleteMaterial(item.id,token);onDeleted?.(item.id);}
  if(!materials?.length)return <div className="empty-state"><div className="empty-icon">📚</div><h2>{t.materialsEmptyTitle||"No saved materials yet"}</h2><p>{t.materialsEmptyBody||"Save a multi-lesson text to continue it here later."}</p></div>;
  return <div className="material-collection-list">{materials.map(item=>{
    const segments=item.segments||[],status=materialStatus(segments),done=segments.filter(s=>s.status==="completed").length,next=segments.find(s=>s.status!=="completed");
    const label={pending:t.materialStatusPending||"To learn",in_progress:t.materialStatusProgress||"In progress",completed:t.materialStatusCompleted||"Completed"}[status];
    return <div className="card card-p material-collection-card" key={item.id}>
      <div className="row wrap" style={{justifyContent:"space-between",gap:10}}><div><span className="badge badge-outline">{label}</span><h3>{item.display_name}</h3><div className="tiny muted">{item.source_type?.toUpperCase()} · {done}/{segments.length} {t.lessonsCompleted||"lessons completed"}</div></div>{next&&<button className="btn btn-primary btn-sm" onClick={()=>onStartSegment?.(item.id,next.id)}>{done?t.continueLearning||"Continue":"Start"}</button>}</div>
      <div className="segment-list">{segments.map(s=><div className="segment-row" key={s.id}><span><b>{s.title||`${t.materialPartLabel||"Part"} ${s.segment_index+1}`}</b><small>{s.word_count} {t.wordsLabel||"words"}</small></span><span>{s.lessonId?<button className="btn btn-ghost btn-sm" onClick={()=>onStartSegment?.(item.id,s.id)}>{t.generationQuota.openLesson}</button>:s.status==="completed"?"✓":`${s.estimated_minutes_min||""}–${s.estimated_minutes_max||""} ${t.minutesShort||"min"}`}</span></div>)}</div>
      <button className="btn btn-ghost btn-sm" onClick={()=>remove(item)}>{t.deleteMaterial||"Delete material"}</button>
    </div>;
  })}</div>;
}
export { MaterialCollection };
