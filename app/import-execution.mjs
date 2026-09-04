export function sourceTimeFromLabel(label) {
  const m=String(label).match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if(!m)return {started_at:null,ended_at:null,basis:'unknown'};
  const stamp=`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`;
  if(!Number.isFinite(Date.parse(stamp)) || new Date(stamp).toISOString()!==stamp)return {started_at:null,ended_at:null,basis:'unknown'};
  return {started_at:stamp,ended_at:null,basis:'inferred_run_label'};
}
