// Named projects are separate from lesson drafts, so upgrades preserve both.
export const PROJECT_KEY='milo-projects.v1';
export class ProjectError extends Error {}
export function createProjectId(random=globalThis.crypto){
  if(typeof random?.randomUUID==='function')return random.randomUUID();
  const bytes=new Uint8Array(16);
  if(typeof random?.getRandomValues==='function')random.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  return Date.now().toString(36)+'-'+[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
function validateName(value){const name=String(value??'').trim().replace(/\s+/g,' ');if(!name)throw new ProjectError('Give your project a name first.');if(name.length>60)throw new ProjectError('Choose a name with 60 characters or fewer.');return name;}
function normalize(record){
  if(!record||typeof record.id!=='string'||typeof record.code!=='string'||record.code.length>20000||typeof record.name!=='string')return null;
  return {id:record.id,name:record.name.slice(0,60),code:record.code,thumbnail:typeof record.thumbnail==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(record.thumbnail)&&record.thumbnail.length<=180000?record.thumbnail:null,createdAt:record.createdAt||new Date().toISOString(),updatedAt:record.updatedAt||record.createdAt||new Date().toISOString(),revision:Number.isInteger(record.revision)?record.revision:1,deletedAt:record.deletedAt||null};
}
export class ProjectStore {
  constructor(storage){this.storage=storage;}
  read(){
    let raw;try{raw=this.storage.getItem(PROJECT_KEY);}catch{throw new ProjectError('Projects cannot be saved in this browser right now. You can still download your program.');}
    if(!raw)return [];
    let data;try{data=JSON.parse(raw);}catch{throw new ProjectError('The saved gallery could not be read. Your lesson drafts are separate. Download your current program before clearing any browser data.');}
    if(!Array.isArray(data.projects))throw new ProjectError('The saved gallery format is not recognized. Download your current program to keep it.');
    const projects=data.projects.map(normalize);if(projects.some(p=>!p))throw new ProjectError('A saved project could not be read. Download your current code before clearing browser data.');return projects;
  }
  write(projects){try{this.storage.setItem(PROJECT_KEY,JSON.stringify({version:1,projects}));}catch{throw new ProjectError('There is not enough browser storage to save this project. Your existing projects are still there. Download your program to keep a copy.');}}
  list({bin=false}={}){return this.read().filter(p=>Boolean(p.deletedAt)===bin).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  get(id){return this.read().find(p=>p.id===id)||null;}
  save({id=null,name,code,thumbnail=null,expectedRevision=null}){
    name=validateName(name);if(typeof code!=='string'||code.length>20000)throw new ProjectError('Keep your program under 20,000 characters.');
    const projects=this.read(),index=id?projects.findIndex(p=>p.id===id):-1;
    if(id&&index<0)throw new ProjectError('This project is no longer in the gallery. Save a copy instead.');
    const old=index>=0?projects[index]:null;
    if(old?.deletedAt)throw new ProjectError('This project is in the bin. Restore it or save a copy.');
    if(old&&expectedRevision!==null&&old.revision!==expectedRevision)throw new ProjectError('This project changed in another tab. Save a copy to keep both versions.');
    if(!old&&projects.filter(p=>!p.deletedAt).length>=30)throw new ProjectError('Your gallery has 30 projects. Move one to the bin before adding another.');
    const now=new Date().toISOString();
    const record=normalize({id:old?.id||createProjectId(),name,code,thumbnail,createdAt:old?.createdAt||now,updatedAt:now,revision:(old?.revision||0)+1,deletedAt:null});
    if(index>=0)projects[index]=record;else projects.push(record);this.write(projects);return record;
  }
  rename(id,name,expectedRevision=null){const old=this.get(id);if(!old)throw new ProjectError('This project is no longer in the gallery.');return this.save({...old,name,expectedRevision});}
  moveToBin(id){const projects=this.read(),p=projects.find(p=>p.id===id);if(!p)throw new ProjectError('This project is no longer in the gallery.');p.deletedAt=new Date().toISOString();p.updatedAt=p.deletedAt;p.revision++;this.write(projects);return p;}
  restore(id){const projects=this.read(),p=projects.find(p=>p.id===id);if(!p)throw new ProjectError('This project is no longer in the bin.');if(projects.filter(p=>!p.deletedAt).length>=30)throw new ProjectError('Make room in your gallery before restoring a project.');p.deletedAt=null;p.updatedAt=new Date().toISOString();p.revision++;this.write(projects);return p;}
}
