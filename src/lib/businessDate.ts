export const BUSINESS_TIMEZONE = 'Asia/Beirut';
export function businessDate(value: string | Date = new Date()): string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 const part=(name:string)=>parts.find(p=>p.type===name)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function dateOffset(key:string,days:number):string {const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
export function matchesPeriod(value:string|Date,period:string,now:Date=new Date()):boolean {
 const key=businessDate(value),today=businessDate(now);
 if(period==='today')return key===today;
 if(period==='week')return key>=dateOffset(today,-6)&&key<=today;
 if(period==='month')return key.slice(0,7)===today.slice(0,7)&&key<=today;
 return true;
}
export function businessHour(value:Date):number {return Number(new Intl.DateTimeFormat('en-GB',{timeZone:BUSINESS_TIMEZONE,hour:'2-digit',hourCycle:'h23'}).format(value));}
export function businessWeekday(value:string|Date):number {return new Date(businessDate(value)+'T12:00:00Z').getUTCDay();}
export function timeBuckets(period:string,dates:string[],now:Date=new Date()):{key:string;label:string}[] {
 const today=businessDate(now);
 if(period==='today')return Array.from({length:24},(_,h)=>({key:String(h),label:`${h}:00`}));
 const keys=period==='week'?Array.from({length:7},(_,i)=>dateOffset(today,i-6)):period==='month'?Array.from({length:new Date(Number(today.slice(0,4)),Number(today.slice(5,7)),0).getDate()},(_,i)=>today.slice(0,8)+String(i+1).padStart(2,'0')):[...new Set(dates.map(d=>businessDate(d)))].sort();
 return keys.map(key=>({key,label:period==='month'?String(Number(key.slice(8))):new Intl.DateTimeFormat('en',{timeZone:'UTC',...(period==='week'?{weekday:'short' as const}:{month:'short' as const,day:'numeric' as const})}).format(new Date(key+'T12:00:00Z'))}));
}
