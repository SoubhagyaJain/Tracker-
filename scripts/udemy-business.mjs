import { z } from 'zod';

const configSchema=z.object({
  subdomain:z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  organization:z.string().regex(/^\d{1,15}$/),
  clientId:z.string().min(1).max(500).refine(value=>!value.includes(':')),
  clientSecret:z.string().min(1).max(500),
  learner:z.email().max(254),
});
const rowSchema=z.object({
  user_email:z.string(),
  course_id:z.union([z.number().int().positive(),z.string().regex(/^\d+$/)]),
  course_title:z.string().trim().min(1).max(250),
  course_duration:z.coerce.number().min(0).max(100000).nullish(),
  completion_ratio:z.coerce.number().min(0).max(100).nullish(),
  course_completion_date:z.string().nullish(),
  course_last_accessed_date:z.string().nullish(),
  num_video_consumed_minutes:z.coerce.number().min(0).max(100000).nullish(),
  course_url:z.string().nullish(),
});
const responseSchema=z.object({results:z.array(z.unknown()).max(300),next:z.string().nullable().optional()});
const requestSchema=z.object({action:z.enum(['test','pull']),consent:z.literal(true)});
export const businessPath='/api/learning/business';

function cleanCourseUrl(value,origin){
  if(!value)return '';
  try{
    const url=new URL(value,origin);
    return url.protocol==='https:'&&(url.origin===origin||url.hostname==='www.udemy.com')&&!url.username&&!url.password&&!url.port&&
      /^\/course\/[a-z0-9-]+(\/|$)/i.test(url.pathname)?url.origin+url.pathname:'';
  }catch{return '';}
}
function cleanTimestamp(value){
  if(!value)return undefined;
  const date=new Date(value);
  return Number.isFinite(date.valueOf())?date.toISOString():undefined;
}

export async function fetchBusinessCourses(values,action,request=fetch,now=new Date()){
  const config=configSchema.parse(values);
  const origin='https://'+config.subdomain+'.udemy.com';
  const path='/api-2.0/organizations/'+config.organization+'/analytics/user-course-activity/';
  const url=new URL(path,origin);
  url.searchParams.set('user_email',config.learner);
  url.searchParams.set('page_size',action==='test'?'1':'100');
  const token=Buffer.from(config.clientId+':'+config.clientSecret).toString('base64');
  const courses=new Map();
  const visited=new Set();
  let next=url;
  let partial=false;
  while(next){
    if(next.origin!==origin||next.pathname!==path||next.username||next.password||visited.has(next.href))throw new Error('Udemy Business returned an unexpected pagination link.');
    next.searchParams.set('user_email',config.learner);
    visited.add(next.href);
    const response=await request(next,{headers:{Accept:'application/json',Authorization:'Basic '+token},redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Udemy Business returned HTTP '+response.status+'. Check the organization and reporting authorization.');
    const payload=responseSchema.parse(await response.json());
    if(action==='test')return {connected:true};
    for(const raw of payload.results){
      const parsed=rowSchema.safeParse(raw);
      if(!parsed.success||parsed.data.user_email.toLowerCase()!==config.learner.toLowerCase())continue;
      const row=parsed.data;
      const externalId=config.subdomain+':'+row.course_id;
      courses.set(externalId,{
        title:row.course_title,externalId,url:cleanCourseUrl(row.course_url,origin),
        durationMinutes:Math.round(row.course_duration??0),percent:row.completion_ratio??undefined,
        reportedAt:now.toISOString(),completedAt:cleanTimestamp(row.course_completion_date),
        providerActivityAt:cleanTimestamp(row.course_last_accessed_date),
        providerVideoMinutes:row.num_video_consumed_minutes==null?undefined:Math.round(row.num_video_consumed_minutes),
      });
    }
    next=payload.next?new URL(payload.next,origin):null;
    if(visited.size>=20&&next){partial=true;break;}
  }
  return {courses:[...courses.values()],partial};
}
function json(response,status,body){
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(body));
}
export async function serveBusiness(request,response,port){
  const host=request.headers.host;
  const origin=request.headers.origin;
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)||origin!=='http://'+host||
      request.method!=='POST'||request.headers['sec-fetch-site']==='cross-site'||
      request.headers['content-type']?.split(';')[0]!=='application/json'){
    json(response,403,{error:'Open the local dashboard and explicitly authorize the Business request.'});return;
  }
  const config=configSchema.safeParse({
    subdomain:process.env.UDEMY_BUSINESS_SUBDOMAIN,organization:process.env.UDEMY_BUSINESS_ORGANIZATION_ID,
    clientId:process.env.UDEMY_BUSINESS_CLIENT_ID,clientSecret:process.env.UDEMY_BUSINESS_CLIENT_SECRET,
    learner:process.env.UDEMY_BUSINESS_LEARNER_EMAIL,
  });
  if(!config.success){json(response,503,{error:'Set the Udemy Business environment variables on the local server.'});return;}
  let body='';
  try{
    for await(const chunk of request){body+=chunk;if(body.length>1024){json(response,413,{error:'Request too large.'});return;}}
    const {action}=requestSchema.parse(JSON.parse(body));
    const result=await fetchBusinessCourses(config.data,action);
    json(response,200,result);
  }catch(error){
    const message=error instanceof Error&&/^Udemy Business returned /.test(error.message)?error.message:'The authorized report could not be read. Check the connection and reporting permissions.';
    json(response,502,{error:message});
  }
}

