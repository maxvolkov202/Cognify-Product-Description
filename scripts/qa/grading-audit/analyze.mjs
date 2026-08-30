import fs from "fs";
import { sql } from "./db.mjs";
// Real-only by default (excludes seed/mock rows); pass --all to include them.
const REAL = !process.argv.includes("--all");
const TAG = REAL ? "_real" : "";
const OUT_DIR = process.env.OUT ?? new URL("./out/", import.meta.url).pathname;
const OUT = OUT_DIR.endsWith("/") ? OUT_DIR : OUT_DIR + "/";
fs.mkdirSync(OUT, { recursive: true });
const DIMS = ["clarity","structure","conciseness","thinking_quality","delivery","tone"];
const out = {};
const log = (k,v)=>{ out[k]=v; console.log("\n## "+k); console.log(typeof v==="string"?v:JSON.stringify(v,null,1)); };

// ---------- load ----------
const reps = await sql`
  select r.id, r.user_id, r.session_id, r.prompt_text, r.duration_ms, r.composite_score, r.model_version, r.rubric_version,
    r.status, r.attempt_kind, r.parent_rep_id, r.created_at, r.score_failure_flag, r.audio_url is not null as has_audio,
    r.exercise_id, r.transcript->>'text' as transcript,
    jsonb_typeof(r.transcript->'words')='array' as has_words,
    coalesce(jsonb_array_length(case when jsonb_typeof(r.transcript->'words')='array' then r.transcript->'words' else '[]'::jsonb end),0) as n_words_timed,
    r.coach_focus, r.feedback->>'headline' as headline, r.feedback is not null as has_feedback,
    (select jsonb_object_agg(d.dimension, d.score) from cognify_v2.dimension_scores d where d.rep_id=r.id) as dims,
    (select jsonb_object_agg(d.dimension, (select array_agg(k) from jsonb_object_keys(case when jsonb_typeof(d.signals)='object' then d.signals else '{}'::jsonb end) k)) from cognify_v2.dimension_scores d where d.rep_id=r.id) as sigkeys
  from cognify_v2.reps r order by r.created_at`;
for (const r of reps){ r.t=new Date(r.created_at).getTime(); r.wc = r.transcript? r.transcript.trim().split(/\s+/).filter(Boolean).length:0; r.wpm = r.duration_ms>0? r.wc/(r.duration_ms/60000):null; r.dims=r.dims||{}; }
const scored = reps.filter(r=>r.composite_score!=null && (!REAL || !["seed-demo-v1","mock-fallback-v1"].includes(r.model_version)));
const NOW = Math.max(...reps.map(r=>r.t)), D=86400000; // anchored to newest rep, not wall clock
const last14 = scored.filter(r=>r.t>=NOW-14*D), prev30 = scored.filter(r=>r.t<NOW-14*D && r.t>=NOW-44*D);

// ---------- helpers ----------
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{ if(a.length<2) return null; const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)); };
const q=(a,p)=>{ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y); const i=(s.length-1)*p; const lo=Math.floor(i), hi=Math.ceil(i); return s[lo]+(s[hi]-s[lo])*(i-lo); };
const r2=x=>x==null?null:Math.round(x*100)/100;
const dist=a=>({ n:a.length, mean:r2(mean(a)), sd:r2(sd(a)), p5:r2(q(a,.05)), p25:r2(q(a,.25)), p50:r2(q(a,.5)), p75:r2(q(a,.75)), p95:r2(q(a,.95)), min:a.length?Math.min(...a):null, max:a.length?Math.max(...a):null, unique:new Set(a).size });
const bands=a=>{ const b={}; for(const x of a){ const k=Math.min(9,Math.floor(x/10))*10; b[k+"-"+(k+9)]=(b[k+"-"+(k+9)]||0)+1;} const o={}; for(const k of Object.keys(b).sort((x,y)=>parseInt(x)-parseInt(y))) o[k]=r2(100*b[k]/a.length)+"%"; return o; };
const top=(a,n=10)=>{ const c={}; for(const x of a) c[x]=(c[x]||0)+1; return Object.entries(c).sort((x,y)=>y[1]-x[1]).slice(0,n).map(([v,c])=>`${v}×${c} (${r2(100*c/a.length)}%)`); };
const pearson=(x,y)=>{ const n=x.length; if(n<3) return null; const mx=mean(x), my=mean(y); let sxy=0,sxx=0,syy=0; for(let i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my); sxx+=(x[i]-mx)**2; syy+=(y[i]-my)**2;} return sxx&&syy? r2(sxy/Math.sqrt(sxx*syy)):null; };
const wk=t=>{ const d=new Date(t); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day); return d.toISOString().slice(0,10); };

// ---------- 2. counts ----------
log("2_counts", { total_reps:reps.length, scored:scored.length, by_status:count(reps,'status'), score_failure_flag:count(reps,'score_failure_flag'), attempt_kind:count(reps,'attempt_kind'), users:new Set(reps.map(r=>r.user_id)).size, has_feedback_doc:count(reps,'has_feedback'), has_audio:count(reps,'has_audio') });
function count(a,k){ const c={}; for(const r of a) c[String(r[k])]=(c[String(r[k])]||0)+1; return c; }
const weeks={}; for(const r of reps){ if(r.t<NOW-84*D) continue; const w=wk(r.t); weeks[w]=weeks[w]||{reps:0,scored:0,users:new Set()}; weeks[w].reps++; if(r.composite_score!=null) weeks[w].scored++; weeks[w].users.add(r.user_id);} 
log("2_reps_per_week_last12", Object.fromEntries(Object.entries(weeks).sort().map(([k,v])=>[k,{reps:v.reps,scored:v.scored,users:v.users.size}])));
log("2_rubric_version", count(reps,'rubric_version'));
log("2_model_version", count(reps,'model_version'));
const rvByMonth={}; for(const r of reps){ const m=r.created_at.toISOString().slice(0,7); rvByMonth[m]=rvByMonth[m]||{}; rvByMonth[m][r.rubric_version]=(rvByMonth[m][r.rubric_version]||0)+1; }
log("2_rubric_version_by_month", rvByMonth);
const tel = await sql`select * from cognify_v2.scoring_telemetry order by created_at`;
log("2_telemetry_counts", { rows:tel.length, source:count(tel,'source'), failure_reason:count(tel,'failure_reason'), arm:count(tel,'arm'), model_used:count(tel,'model_used'), with_rep_id:tel.filter(t=>t.rep_id).length });
const fbByMonth={}; for(const t of tel){ const m=t.created_at.toISOString().slice(0,7); fbByMonth[m]=fbByMonth[m]||{n:0,fallback:0,fail:0,mock:0}; fbByMonth[m].n++; if(/fallback_used/.test(t.failure_reason)) fbByMonth[m].fallback++; if(t.failure_reason!=='none'&&!/fallback_used/.test(t.failure_reason)) fbByMonth[m].fail++; if(t.model_used==='mock-fallback-v1') fbByMonth[m].mock++; }
log("2_telemetry_by_month", fbByMonth);
const muByMonth={}; for(const t of tel){ const m=t.created_at.toISOString().slice(0,7); muByMonth[m]=muByMonth[m]||{}; muByMonth[m][t.model_used]=(muByMonth[m][t.model_used]||0)+1; }
log("2_model_used_by_month", muByMonth);

// ---------- 3. distributions ----------
function dimStats(set,label){ const o={}; for(const d of [...DIMS,'composite']){ const a=set.map(r=>d==='composite'?r.composite_score:r.dims[d]).filter(x=>x!=null); o[d]={...dist(a), bands:bands(a), top10:top(a)}; } log("3_dist_"+label,o); return o; }
dimStats(scored,"ALL"); dimStats(last14,"last14d"); dimStats(prev30,"prev30d");
// weekly delivery/tone variance
const wv={}; for(const r of scored){ const w=wk(r.t); wv[w]=wv[w]||{n:0,delivery:[],tone:[],eq:0,comp:[]}; wv[w].n++; if(r.dims.delivery!=null) wv[w].delivery.push(r.dims.delivery); if(r.dims.tone!=null) wv[w].tone.push(r.dims.tone); if(r.dims.delivery!=null&&r.dims.delivery===r.dims.tone) wv[w].eq++; wv[w].comp.push(r.composite_score);} 
log("3_weekly_delivery_tone", Object.fromEntries(Object.entries(wv).sort().map(([k,v])=>[k,{n:v.n, del_mean:r2(mean(v.delivery)), del_sd:r2(sd(v.delivery)), del_uniq:new Set(v.delivery).size, del_top:top(v.delivery,3).join(' '), tone_mean:r2(mean(v.tone)), tone_sd:r2(sd(v.tone)), tone_uniq:new Set(v.tone).size, tone_top:top(v.tone,3).join(' '), del_eq_tone:v.eq, comp_mean:r2(mean(v.comp)), comp_sd:r2(sd(v.comp))}])));
// by rubric version
const byRv={}; for(const r of scored){ byRv[r.rubric_version]=byRv[r.rubric_version]||[]; byRv[r.rubric_version].push(r);} 
log("3_by_rubric_version", Object.fromEntries(Object.entries(byRv).map(([k,v])=>[k,{n:v.length, composite:dist(v.map(r=>r.composite_score)), delivery:dist(v.map(r=>r.dims.delivery).filter(x=>x!=null)), tone:dist(v.map(r=>r.dims.tone).filter(x=>x!=null)), del_top:top(v.map(r=>r.dims.delivery).filter(x=>x!=null),5), tone_top:top(v.map(r=>r.dims.tone).filter(x=>x!=null),5)}])));

// ---------- 4. correlations ----------
const full = scored.filter(r=>DIMS.every(d=>r.dims[d]!=null));
const mat={}; for(const a of [...DIMS,'composite']){ mat[a]={}; for(const b of [...DIMS,'composite']) mat[a][b]=pearson(full.map(r=>a==='composite'?r.composite_score:r.dims[a]), full.map(r=>b==='composite'?r.composite_score:r.dims[b])); }
log("4_pearson_all (n="+full.length+")", mat);
const fullRecent = full.filter(r=>r.t>=NOW-14*D); const matR={}; for(const a of DIMS){ matR[a]={}; for(const b of DIMS) matR[a][b]=pearson(fullRecent.map(r=>r.dims[a]), fullRecent.map(r=>r.dims[b])); }
log("4_pearson_last14 (n="+fullRecent.length+")", matR);
const fullPrev = full.filter(r=>r.t<NOW-14*D && r.t>=NOW-44*D); const matP={}; for(const a of DIMS){ matP[a]={}; for(const b of DIMS) matP[a][b]=pearson(fullPrev.map(r=>r.dims[a]), fullPrev.map(r=>r.dims[b])); }
log("4_pearson_prev30 (n="+fullPrev.length+")", matP);
const wcorr={}; for(const d of [...DIMS,'composite']){ const s=full.filter(r=>r.wpm!=null); wcorr[d]={ word_count:pearson(s.map(r=>d==='composite'?r.composite_score:r.dims[d]), s.map(r=>r.wc)), duration_s:pearson(s.map(r=>d==='composite'?r.composite_score:r.dims[d]), s.map(r=>r.duration_ms)), wpm:pearson(s.map(r=>d==='composite'?r.composite_score:r.dims[d]), s.map(r=>r.wpm)) }; }
log("4_corr_with_length", { ...wcorr, word_count:dist(full.map(r=>r.wc)), duration_s:dist(full.map(r=>r.duration_ms/1000)), wpm:dist(full.filter(r=>r.wpm).map(r=>r.wpm)) });
// mean pairwise off-diagonal r
const offs=[]; for(const a of DIMS) for(const b of DIMS) if(a<b) offs.push(mat[a][b]); log("4_mean_offdiag_r", r2(mean(offs)));

// ---------- 5. latency ----------
function lat(set){ const o={}; for(const k of ['model_duration_ms','validation_duration_ms','total_server_duration_ms','rag_duration_ms','prompt_size_bytes','input_tokens','output_tokens','cache_read_tokens']){ const a=set.map(t=>t[k]).filter(x=>x!=null); o[k]={n:a.length,p50:r2(q(a,.5)),p90:r2(q(a,.9)),p99:r2(q(a,.99)),mean:r2(mean(a))}; } return o; }
log("5_latency_all", lat(tel));
const byModel={}; for(const t of tel){ (byModel[t.model_used]=byModel[t.model_used]||[]).push(t);} log("5_latency_by_model", Object.fromEntries(Object.entries(byModel).map(([k,v])=>[k,{n:v.length, total_p50:r2(q(v.map(t=>t.total_server_duration_ms).filter(x=>x!=null),.5)), total_p90:r2(q(v.map(t=>t.total_server_duration_ms).filter(x=>x!=null),.9)), model_p50:r2(q(v.map(t=>t.model_duration_ms).filter(x=>x!=null),.5)), model_p90:r2(q(v.map(t=>t.model_duration_ms).filter(x=>x!=null),.9))}])));
const byArm={}; for(const t of tel){ (byArm[String(t.arm)]=byArm[String(t.arm)]||[]).push(t);} log("5_latency_by_arm", Object.fromEntries(Object.entries(byArm).map(([k,v])=>[k,{n:v.length, total_p50:r2(q(v.map(t=>t.total_server_duration_ms).filter(x=>x!=null),.5)), model_p50:r2(q(v.map(t=>t.model_duration_ms).filter(x=>x!=null),.5))}])));
const lw={}; for(const t of tel){ const w=wk(t.created_at.getTime()); (lw[w]=lw[w]||[]).push(t);} log("5_latency_by_week", Object.fromEntries(Object.entries(lw).sort().map(([k,v])=>[k,{n:v.length, total_p50:r2(q(v.map(t=>t.total_server_duration_ms).filter(x=>x!=null),.5)), total_p90:r2(q(v.map(t=>t.total_server_duration_ms).filter(x=>x!=null),.9)), model_p50:r2(q(v.map(t=>t.model_duration_ms).filter(x=>x!=null),.5)), rag_p50:r2(q(v.map(t=>t.rag_duration_ms).filter(x=>x!=null),.5)), rag_null:v.filter(t=>t.rag_duration_ms==null).length, rag_zero:v.filter(t=>t.rag_duration_ms===0).length, fails:v.filter(t=>t.failure_reason!=='none').length}])));

// ---------- 6. RAG ----------
const kc = await sql`select split_part(source_file,'/',1) as folder, count(*)::int n, count(distinct source_file)::int files, sum(token_count)::int tokens from cognify_v2.knowledge_chunks group by 1 order by 2 desc`;
const kcKind = await sql`select tags->>'kind' as kind, count(*)::int n from cognify_v2.knowledge_chunks group by 1 order by 2 desc`;
const kcFiles = await sql`select source_file, count(*)::int n from cognify_v2.knowledge_chunks group by 1 order by 2 desc limit 40`;
log("6_knowledge_chunks", { by_folder:kc, by_kind:kcKind, top_files:kcFiles, rag_duration_rows_nonnull:tel.filter(t=>t.rag_duration_ms!=null).length, rag_duration_zero:tel.filter(t=>t.rag_duration_ms===0).length, rag_duration_dist:dist(tel.map(t=>t.rag_duration_ms).filter(x=>x!=null)) });
// any rag evidence in signals/feedback? check keys
const allSigKeys={}; for(const r of reps){ if(!r.sigkeys) continue; for(const [d,ks] of Object.entries(r.sigkeys)) for(const k of (ks||[])) allSigKeys[k]=(allSigKeys[k]||0)+1; }
log("6_signal_keys_freq", allSigKeys);
const fbKeys = await sql`select k, count(*)::int n from cognify_v2.reps r, jsonb_object_keys(r.feedback) k where jsonb_typeof(r.feedback)='object' group by 1 order by 2 desc`;
log("6_feedback_doc_keys", fbKeys);

// ---------- 7. coverage ----------
const cov={}; for(const r of reps){ const w=wk(r.t); cov[w]=cov[w]||{n:0,words:0,audio:0,prosody:0,anySignals:0}; cov[w].n++; if(r.has_words) cov[w].words++; if(r.has_audio) cov[w].audio++; const sk=JSON.stringify(r.sigkeys||{}); if(/prosod|pitch|rms|pause/i.test(sk)) cov[w].prosody++; if(r.sigkeys && Object.values(r.sigkeys).some(v=>v&&v.length)) cov[w].anySignals++; }
log("7_coverage_by_week", Object.fromEntries(Object.entries(cov).sort().map(([k,v])=>[k,{n:v.n, words_pct:r2(100*v.words/v.n), audio_pct:r2(100*v.audio/v.n), prosody_sig_pct:r2(100*v.prosody/v.n), any_signals_pct:r2(100*v.anySignals/v.n)}])));
log("7_coverage_total", { words:reps.filter(r=>r.has_words).length, audio:reps.filter(r=>r.has_audio).length, n:reps.length });

// ---------- 8. retry ----------
const byId=Object.fromEntries(reps.map(r=>[r.id,r]));
const retries=scored.filter(r=>r.parent_rep_id && byId[r.parent_rep_id] && byId[r.parent_rep_id].composite_score!=null);
const deltas={}; for(const d of [...DIMS,'composite']){ const a=retries.map(r=>{ const p=byId[r.parent_rep_id]; const x=d==='composite'?r.composite_score:r.dims[d], y=d==='composite'?p.composite_score:p.dims[d]; return x!=null&&y!=null? x-y:null;}).filter(x=>x!=null); deltas[d]={n:a.length, mean:r2(mean(a)), sd:r2(sd(a)), p50:r2(q(a,.5)), pct_up:r2(100*a.filter(x=>x>0).length/a.length), pct_same:r2(100*a.filter(x=>x===0).length/a.length), pct_down:r2(100*a.filter(x=>x<0).length/a.length)}; }
log("8_retry_deltas_parent_link", {n_retries:retries.length, deltas});
// fallback: same user + same prompt consecutive
const grp={}; for(const r of scored){ const k=r.user_id+"|"+r.prompt_text; (grp[k]=grp[k]||[]).push(r);} const pairs=[]; for(const g of Object.values(grp)){ for(let i=1;i<g.length;i++) pairs.push([g[i-1],g[i]]); }
const d2={}; for(const d of [...DIMS,'composite']){ const a=pairs.map(([p,r])=>{ const x=d==='composite'?r.composite_score:r.dims[d], y=d==='composite'?p.composite_score:p.dims[d]; return x!=null&&y!=null? x-y:null;}).filter(x=>x!=null); d2[d]={n:a.length, mean:r2(mean(a)), p50:r2(q(a,.5)), pct_up:r2(100*a.filter(x=>x>0).length/a.length)}; }
log("8_retry_deltas_same_user_same_prompt", {n_pairs:pairs.length, groups_with_repeat:Object.values(grp).filter(g=>g.length>1).length, deltas:d2, attempt_kind_counts:count(scored,'attempt_kind')});
// per-user trend first 20
const byUser={}; for(const r of scored){ (byUser[r.user_id]=byUser[r.user_id]||[]).push(r);} const idxAgg={}; const slopes=[]; for(const [u,rs] of Object.entries(byUser)){ rs.sort((a,b)=>a.t-b.t); rs.slice(0,20).forEach((r,i)=>{ (idxAgg[i+1]=idxAgg[i+1]||[]).push(r.composite_score); }); if(rs.length>=5){ const xs=rs.slice(0,20).map((_,i)=>i+1), ys=rs.slice(0,20).map(r=>r.composite_score); const mx=mean(xs),my=mean(ys); let n=0,dd=0; for(let i=0;i<xs.length;i++){n+=(xs[i]-mx)*(ys[i]-my); dd+=(xs[i]-mx)**2;} slopes.push({user:u.slice(0,8), n:rs.length, slope_per_rep:r2(n/dd), first3:r2(mean(ys.slice(0,3))), last3:r2(mean(ys.slice(-3)))}); } }
log("8_user_trend", { users_total:Object.keys(byUser).length, users_ge5_reps:slopes.length, reps_per_user:dist(Object.values(byUser).map(v=>v.length)), mean_composite_by_rep_index:Object.fromEntries(Object.entries(idxAgg).map(([k,v])=>[k,{n:v.length,mean:r2(mean(v))}])), mean_slope:r2(mean(slopes.map(s=>s.slope_per_rep))), median_slope:r2(q(slopes.map(s=>s.slope_per_rep),.5)), slopes });

// ---------- 9. sample ----------
const bandsDef=[["<50",x=>x<50],["50-65",x=>x>=50&&x<65],["65-75",x=>x>=65&&x<75],["75-85",x=>x>=75&&x<85],["85+",x=>x>=85]];
const sample=[]; for(const [name,f] of bandsDef){ const pool=scored.filter(r=>f(r.composite_score)&&r.transcript).sort((a,b)=>b.t-a.t); const step=Math.max(1,Math.floor(pool.length/5)); const pick=[]; for(let i=0;i<pool.length&&pick.length<5;i+=step) pick.push(pool[i]); for(const r of pick) sample.push({band:name, id:r.id, created_at:r.created_at, rubric_version:r.rubric_version, model_version:r.model_version, attempt_kind:r.attempt_kind, prompt:r.prompt_text, transcript:r.transcript.slice(0,600), word_count:r.wc, duration_s:r2(r.duration_ms/1000), composite:r.composite_score, ...Object.fromEntries(DIMS.map(d=>[d,r.dims[d]])), headline:r.headline, coach_focus:r.coach_focus, pool_size:pool.length}); }
fs.writeFileSync(OUT+"sample25"+TAG+".json", JSON.stringify(sample,null,2));
log("9_sample_summary", sample.map(s=>({band:s.band,id:s.id.slice(0,8),date:s.created_at.toISOString().slice(0,10),rv:s.rubric_version,wc:s.word_count,comp:s.composite,cl:s.clarity,st:s.structure,co:s.conciseness,tq:s.thinking_quality,de:s.delivery,to:s.tone,headline:(s.headline||'').slice(0,90)})));

// ---------- 10. anomalies ----------
const shortHigh=scored.filter(r=>r.wc<15&&r.composite_score>60).map(r=>({id:r.id.slice(0,8),date:r.created_at.toISOString().slice(0,10),wc:r.wc,comp:r.composite_score,dims:r.dims,transcript:(r.transcript||'').slice(0,150),rv:r.rubric_version}));
const byT={}; for(const r of scored){ if(!r.transcript) continue; const k=r.transcript.trim().toLowerCase(); (byT[k]=byT[k]||[]).push(r);} const dupT=Object.values(byT).filter(g=>g.length>1).map(g=>({n:g.length, users:new Set(g.map(r=>r.user_id)).size, wc:g[0].wc, transcript:g[0].transcript.slice(0,100), composites:g.map(r=>r.composite_score), dates:g.map(r=>r.created_at.toISOString().slice(0,10)), dims:g.map(r=>DIMS.map(d=>r.dims[d]).join('/'))}));
const delEqTone=scored.filter(r=>r.dims.delivery!=null&&r.dims.delivery===r.dims.tone);
const allEq=scored.filter(r=>DIMS.every(d=>r.dims[d]!=null)&&new Set(DIMS.map(d=>r.dims[d])).size===1);
const delTonePairs={}; for(const r of scored){ if(r.dims.delivery==null) continue; const k=r.dims.delivery+"/"+r.dims.tone; delTonePairs[k]=(delTonePairs[k]||0)+1; }
const shortAll=scored.filter(r=>r.wc<15).map(r=>({wc:r.wc,comp:r.composite_score}));
const dimMissing=scored.filter(r=>!DIMS.every(d=>r.dims[d]!=null)).length;
const emptyTranscript=scored.filter(r=>!r.transcript||r.wc===0).map(r=>({id:r.id.slice(0,8),comp:r.composite_score,date:r.created_at.toISOString().slice(0,10),dims:r.dims}));
log("10_anomalies", { short_lt15w_over60:shortHigh, short_lt15w_all:shortAll, empty_transcript_scored:emptyTranscript, duplicate_transcripts:dupT, delivery_eq_tone:{n:delEqTone.length, pct:r2(100*delEqTone.length/scored.length), by_rv:count(delEqTone,'rubric_version'), last14:last14.filter(r=>r.dims.delivery!=null&&r.dims.delivery===r.dims.tone).length+"/"+last14.length}, all_six_equal:allEq.length, top_delivery_tone_pairs:Object.entries(delTonePairs).sort((a,b)=>b[1]-a[1]).slice(0,10), scored_missing_some_dim:dimMissing, composite_vs_mean_of_dims:dist(full.map(r=>r.composite_score-mean(DIMS.map(d=>r.dims[d])))) });

fs.writeFileSync(OUT+"analysis"+TAG+".json", JSON.stringify(out,null,1));
await sql.end();
