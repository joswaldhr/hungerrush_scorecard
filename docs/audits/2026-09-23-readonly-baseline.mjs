// Audit diagnostic only. All database work is in a READ ONLY transaction.
// Run from repository root: node --env-file=.env docs/audits/2026-09-23-readonly-baseline.mjs
import postgres from 'postgres';
import { writeFileSync } from 'node:fs';
const db = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10, idle_timeout: 5 });
const output = { capturedAt: new Date().toISOString(), measurements: {} };
try {
  await db.begin('read only', async sql => {
    await sql`set local statement_timeout = '15s'`;
    const queries = {
      server: `select now() as captured_at, current_setting('server_version') as version, current_setting('transaction_read_only') as read_only`,
      counts: `select 'employees' as entity,count(*) from employees union all select 'metric_definitions',count(*) from metric_definitions union all select 'source_records',count(*) from source_records union all select 'normalized_facts',count(*) from normalized_facts union all select 'metric_values',count(*) from metric_values union all select 'sync_runs',count(*) from sync_runs union all select 'sync_errors',count(*) from sync_errors`,
      sources: `select type,status,last_successful_sync_at from data_sources`,
      runs: `select status,started_at,completed_at,records_ingested,records_normalized,records_skipped,error_count,metadata_json from sync_runs order by started_at desc limit 16`,
      periods: `select period_start,period_end,count(*) as values,count(numeric_value) as nonnull_values,min(data_freshness_at) as min_freshness,max(data_freshness_at) as max_freshness from metric_values group by 1,2 order by 1 desc limit 16`,
      definitions: `select key,name,unit,value_type,direction,calculation_type,source_strategy,version,status from metric_definitions order by key`,
      assignments: `select t.name as team,d.key,a.display_order,a.is_primary from metric_assignments a join teams t on t.id=a.team_id join metric_definitions d on d.id=a.metric_definition_id order by t.name,a.display_order`,
      targets: `select d.key,t.name as team,mt.line,mt.target_type,mt.target_value,mt.warning_value,mt.target_min,mt.target_max,mt.effective_from,mt.effective_to,mt.priority from metric_targets mt join metric_definitions d on d.id=mt.metric_definition_id left join teams t on t.id=mt.team_id order by d.key,t.name,mt.line`,
      samples: `with ranked as (select id,primary_team_id,line,row_number() over(partition by primary_team_id,line order by id) as rn from employees where employment_status='active'), sample as (select *,dense_rank() over(order by primary_team_id,line) as sample_number from ranked where rn=1) select 'employee-sample-'||s.sample_number as employee_alias,t.name as team,s.line,d.key,m.period_start,m.period_end,m.numeric_value,m.quality_status,m.calculation_version,m.data_freshness_at from sample s join metric_values m on m.employee_id=s.id join metric_definitions d on d.id=m.metric_definition_id left join teams t on t.id=s.primary_team_id where m.period_start>='2026-08-23' order by s.sample_number,m.period_start,d.key`,
      staleFacts: `select count(*) as metrics_newer_than_facts from metric_values m join metric_definitions d on d.id=m.metric_definition_id where exists(select 1 from normalized_facts f where f.employee_id=m.employee_id and f.fact_type=d.key and f.period_start=m.period_start and m.data_freshness_at>f.source_observed_at+interval '1 day')`,
      duplicateVisibility: `select scope, count(*) as duplicate_groups from (select scope,manager_user_id,target_employee_id,metric_definition_id,team_id,line,count(*) from metric_visibility_overrides group by 1,2,3,4,5,6 having count(*)>1) x group by scope`,
      duplicateDepartures: `select count(*) as duplicate_groups from (select data_source_id,external_id,change_type,count(*) from roster_candidates where status='pending' group by 1,2,3 having count(*)>1) x`,
      unmapped: `select count(*) from source_records where employee_id is null`,
      staleNullFacts: `select f.fact_type,count(*) from normalized_facts f join source_records s on s.id=f.source_record_id where (f.fact_type='csat_score' and s.payload_json->>'csatScore' is null) or (f.fact_type='avg_handle_time' and s.payload_json->>'avgHandleTimeMinutes' is null) or (f.fact_type='avg_response_time' and s.payload_json->>'avgResponseTimeMinutes' is null) group by f.fact_type`,
      coverage: `select count(*) as active_employees,count(*) filter(where e.line is null) as without_line,count(*) filter(where exists(select 1 from external_identities i join data_sources s on s.id=i.data_source_id where i.employee_id=e.id and s.type='zendesk')) as zendesk_mapped from employees e where employment_status='active'`,
      csatEvidence: `select period_start,count(*) as summaries,count(*) filter(where (payload_json->>'totalRatings')::int>0) as with_ratings,sum((payload_json->>'totalRatings')::int) as total_ratings from source_records where external_record_type='csat_summary' group by 1 order by 1 desc limit 6`,
      runStates: `select status,count(*),min(started_at) as oldest,max(started_at) as newest from sync_runs group by status`,
      version: `select count(*) as organizations from organizations`,
      indexes: `select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`,
      queryPlan: `explain (analyze, buffers, format json) select * from normalized_facts where organization_id=(select id from organizations limit 1) and fact_type='tickets_resolved'`,
    };
    for (const [name, query] of Object.entries(queries)) {
      const start = performance.now();
      output.measurements[name] = { rows: await sql.unsafe(query), elapsedMs: Math.round((performance.now()-start)*100)/100 };
    }
  });
  writeFileSync(new URL('./2026-09-23-baseline.json', import.meta.url), JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ok:true, capturedAt:output.capturedAt, results:Object.fromEntries(Object.entries(output.measurements).map(([k,v])=>[k,{rowCount:v.rows.length,elapsedMs:v.elapsedMs}]))}));
} catch (error) {
  console.error(JSON.stringify({ok:false, code:error.code, message:error.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]')}));
  process.exitCode=1;
} finally { await db.end({timeout:5}); }
