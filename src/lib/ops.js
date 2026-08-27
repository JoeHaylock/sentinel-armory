import Kit from './kit.js';

const R = Kit.rng(20260816);

export const ST_LBL = { ok: 'Running', warn: 'Watch', crit: 'Alert', off: 'Offline' };

/* ── device matrix ── */
const LINES=['CNC','Molding','Assembly','Packaging'];
const devs=Array.from({length:32},(_,i)=>{
  const r=R();
  const st=r<.78?'ok':r<.88?'warn':r<.95?'crit':'off';
  return {id:'M-'+(101+i),line:LINES[Math.floor(i/8)],st,run:Math.round(400+R()*7200)};
});

/* ── work orders ── */
const STAGES=['Open','Working','Complete','Verified'];
const FAULTS=['Abnormal spindle noise; possible bearing wear','Hydraulic oil temperature high at 62°C','Conveyor tracking off by 3cm','Air pressure fluctuating ±0.4MPa','Tool life remaining: 8%','Coolant concentration low','Safety-door sensor intermittently failing','Vibration at 4.2mm/s exceeds limit'];
let tickets=Array.from({length:9},(_,i)=>{
  const dev=devs[Math.floor(R()*32)];
  const st=STAGES[Math.floor(Math.pow(R(),1.4)*4)];
  const h=Math.round(R()*30+1);
  return {id:'WO-'+(2610+i),dev:dev.id,line:dev.line,ti:FAULTS[Math.floor(R()*FAULTS.length)],
    st,h,over:st!=='Verified'&&h>24,by:['A. Reyes','M. Okafor','N. Bennett'][Math.floor(R()*3)],photo:R()<.4};
});

/* ── vitals ── */
const VITALS={done:47,plan:56,abn:3,miss:2,wo:()=>tickets.filter(t=>t.st!=='Verified').length};
function blocks(pc,n=14){
  const on=Math.round(pc/100*n);
  return `<span>${'█'.repeat(on)}</span><span class="off">${'█'.repeat(n-on)}</span>`;
}

/* ── event log ── */
const ACTS=[['SCAN_OK','ok'],['CHECK_PASS','ok'],['PARAM_SYNC','ok'],['TEMP_WARN','warn'],['VIB_WARN','warn'],['PHOTO_UPLD','ok'],['WO_CREATE','warn'],['AUTH_OK','ok']];
function hex(n){return '0x'+n.toString(16).toUpperCase().padStart(6,'0')}
/* The opening 14 log rows are generated here in the module: they must draw
   from the same seeded sequence in order. Generating them inside the component
   would interleave with the device / ticket draws and change the matrix. */
export const SEED_LOG = Array.from({length:14},(_,i)=>{
  const [a,lv]=ACTS[Math.floor(R()*ACTS.length)];
  return {t:new Date(Date.now()-(14-i)*47000).toTimeString().slice(0,8),
          pid:'PID_'+(1000+Math.floor(R()*9000)),
          act:a+' · M-'+(101+Math.floor(R()*32)), cd:hex(Math.floor(R()*0xFFFFF)), lv};
});

export { R, LINES, devs, STAGES, FAULTS, tickets, VITALS, blocks, ACTS, hex };
