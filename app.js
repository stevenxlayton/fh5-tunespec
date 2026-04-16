/* ============================================================
 * TuneSpec v3.1 — FH5 Tuning Calculator (research-backed)
 * Fixes from v3.0: correct FH5 tire compound names,
 * keyboard no longer drops on input (partial re-render)
 * ============================================================ */
'use strict';

/* =============================================
 * EMBEDDED CAR DATA
 * ============================================= */
var SEED_CARS=[
{"id":"abarth-124-spider-2017","make":"Abarth","model":"124 Spider","year":2017,"stockPI":500,"stockClass":"D","drivetrain":"RWD","engineLayout":"Front","bodyType":"Convertible","driftFriendly":true},
{"id":"abarth-595-esseesse-1968","make":"Abarth","model":"595 esseesse","year":1968,"stockPI":100,"stockClass":"D","drivetrain":"RWD","engineLayout":"Rear","bodyType":"Hatchback","driftFriendly":false},
{"id":"abarth-fiat-131-1980","make":"Abarth","model":"Fiat 131","year":1980,"stockPI":400,"stockClass":"D","drivetrain":"RWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":true},
{"id":"acura-integra-type-r-2001","make":"Acura","model":"Integra Type-R","year":2001,"stockPI":500,"stockClass":"D","drivetrain":"FWD","engineLayout":"Front","bodyType":"Coupe","driftFriendly":false},
{"id":"acura-nsx-2017","make":"Acura","model":"NSX","year":2017,"stockPI":800,"stockClass":"S1","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"alpine-a110-2017","make":"Alpine","model":"A110","year":2017,"stockPI":700,"stockClass":"A","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Coupe","driftFriendly":false},
{"id":"amc-javelin-amx-1971","make":"AMC","model":"Javelin AMX","year":1971,"stockPI":500,"stockClass":"D","drivetrain":"RWD","engineLayout":"Front","bodyType":"Muscle","driftFriendly":true},
{"id":"ariel-atom-500-v8-2013","make":"Ariel","model":"Atom 500 V8","year":2013,"stockPI":924,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Track Toy","driftFriendly":false},
{"id":"aston-martin-db11-2017","make":"Aston Martin","model":"DB11","year":2017,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"GT","driftFriendly":true},
{"id":"aston-martin-valkyrie-2023","make":"Aston Martin","model":"Valkyrie","year":2023,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"aston-martin-vulcan-2016","make":"Aston Martin","model":"Vulcan","year":2016,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Track Toy","driftFriendly":false},
{"id":"ats-gt-2018","make":"ATS","model":"GT","year":2018,"stockPI":877,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"audi-rs-3-sedan-2020","make":"Audi","model":"RS 3 Sedan","year":2020,"stockPI":734,"stockClass":"A","drivetrain":"AWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":false},
{"id":"audi-rs-4-avant-2018","make":"Audi","model":"RS 4 Avant","year":2018,"stockPI":751,"stockClass":"A","drivetrain":"AWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":false},
{"id":"audi-rs-7-sportback-2021","make":"Audi","model":"RS 7 Sportback","year":2021,"stockPI":768,"stockClass":"A","drivetrain":"AWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":false},
{"id":"audi-rs-e-tron-gt-2021","make":"Audi","model":"RS e-tron GT","year":2021,"stockPI":770,"stockClass":"A","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Sedan","driftFriendly":false},
{"id":"auto-union-type-d-1939","make":"Auto Union","model":"Type D","year":1939,"stockPI":700,"stockClass":"A","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Classic","driftFriendly":false},
{"id":"bmw-m3-1997","make":"BMW","model":"M3","year":1997,"stockPI":600,"stockClass":"C","drivetrain":"RWD","engineLayout":"Front","bodyType":"Coupe","driftFriendly":true},
{"id":"bmw-m5-2009","make":"BMW","model":"M5","year":2009,"stockPI":700,"stockClass":"A","drivetrain":"RWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":true},
{"id":"bmw-m5-cs-2022","make":"BMW","model":"M5 CS","year":2022,"stockPI":827,"stockClass":"S1","drivetrain":"AWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":false},
{"id":"bugatti-chiron-2018","make":"Bugatti","model":"Chiron","year":2018,"stockPI":998,"stockClass":"S2","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"bugatti-divo-2019","make":"Bugatti","model":"Divo","year":2019,"stockPI":998,"stockClass":"S2","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"cadillac-ats-v-2016","make":"Cadillac","model":"ATS-V","year":2016,"stockPI":700,"stockClass":"A","drivetrain":"RWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":false},
{"id":"cadillac-ct5-v-blackwing-2022","make":"Cadillac","model":"CT5-V Blackwing","year":2022,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":false},
{"id":"chevrolet-camaro-z28-2015","make":"Chevrolet","model":"Camaro Z/28","year":2015,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Muscle","driftFriendly":true},
{"id":"dodge-charger-rt-1969","make":"Dodge","model":"Charger R/T","year":1969,"stockPI":500,"stockClass":"D","drivetrain":"RWD","engineLayout":"Front","bodyType":"Muscle","driftFriendly":true},
{"id":"donkervoort-d8-gto-2013","make":"Donkervoort","model":"D8 GTO","year":2013,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Track Toy","driftFriendly":false},
{"id":"ferrari-458-italia-2009","make":"Ferrari","model":"458 Italia","year":2009,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"ferrari-488-gtb-2015","make":"Ferrari","model":"488 GTB","year":2015,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"ferrari-enzo-ferrari-2002","make":"Ferrari","model":"Enzo Ferrari","year":2002,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"ferrari-f12tdf-2015","make":"Ferrari","model":"F12tdf","year":2015,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Supercar","driftFriendly":false},
{"id":"ferrari-f50-gt-1996","make":"Ferrari","model":"F50 GT","year":1996,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Track Toy","driftFriendly":false},
{"id":"ferrari-fxx-k-2014","make":"Ferrari","model":"FXX K","year":2014,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Track Toy","driftFriendly":false},
{"id":"ferrari-laferrari-2013","make":"Ferrari","model":"LaFerrari","year":2013,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"ferrari-monza-sp2-2019","make":"Ferrari","model":"Monza SP2","year":2019,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Supercar","driftFriendly":false},
{"id":"ferrari-sf90-stradale-2020","make":"Ferrari","model":"SF90 Stradale","year":2020,"stockPI":900,"stockClass":"S1","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"ford-mustang-rtr-2018","make":"Ford","model":"#25 Mustang RTR","year":2018,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Drift Car","driftFriendly":true},
{"id":"ford-bronco-2021","make":"Ford","model":"Bronco","year":2021,"stockPI":600,"stockClass":"C","drivetrain":"AWD","engineLayout":"Front","bodyType":"OffRoad","driftFriendly":false},
{"id":"ford-gt-2017","make":"Ford","model":"GT","year":2017,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"ford-gt40-1964","make":"Ford","model":"GT40","year":1964,"stockPI":800,"stockClass":"A","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Classic","driftFriendly":false},
{"id":"formula-drift-nissan-370z-2018","make":"Formula Drift","model":"#64 Nissan 370Z","year":2018,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Drift Car","driftFriendly":true},
{"id":"formula-drift-bmw-m2-2020","make":"Formula Drift","model":"#91 BMW M2","year":2020,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Drift Car","driftFriendly":true},
{"id":"honda-civic-type-r-1997","make":"Honda","model":"Civic Type R","year":1997,"stockPI":500,"stockClass":"D","drivetrain":"FWD","engineLayout":"Front","bodyType":"Hatchback","driftFriendly":false},
{"id":"honda-civic-type-r-2004","make":"Honda","model":"Civic Type-R","year":2004,"stockPI":500,"stockClass":"C","drivetrain":"FWD","engineLayout":"Front","bodyType":"Hatchback","driftFriendly":false},
{"id":"hoonigan-ford-hoonicorn-mustang-1965","make":"Hoonigan","model":"Ford Mustang","year":1965,"stockPI":900,"stockClass":"S2","drivetrain":"AWD","engineLayout":"Front","bodyType":"Drift Car","driftFriendly":true},
{"id":"koenigsegg-jesko-2020","make":"Koenigsegg","model":"Jesko","year":2020,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"koenigsegg-one-1-2015","make":"Koenigsegg","model":"One:1","year":2015,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"lamborghini-aventador-lp700-4-2012","make":"Lamborghini","model":"Aventador 4","year":2012,"stockPI":900,"stockClass":"S1","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"lamborghini-huracan-lp-610-4-2014","make":"Lamborghini","model":"Huracan LP 4","year":2014,"stockPI":900,"stockClass":"S1","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"lexus-lfa-2010","make":"Lexus","model":"LFA","year":2010,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Supercar","driftFriendly":false},
{"id":"lotus-emira-2023","make":"Lotus","model":"Emira","year":2023,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Sports Car","driftFriendly":false},
{"id":"maserati-gran-turismo-s-2010","make":"Maserati","model":"Gran Turismo S","year":2010,"stockPI":700,"stockClass":"A","drivetrain":"RWD","engineLayout":"Front","bodyType":"GT","driftFriendly":false},
{"id":"mazda-rx-7-1997","make":"Mazda","model":"RX-7","year":1997,"stockPI":600,"stockClass":"C","drivetrain":"RWD","engineLayout":"Front","bodyType":"Coupe","driftFriendly":true},
{"id":"mclaren-f1-gt-1997","make":"McLaren","model":"F1 GT","year":1997,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"mclaren-senna-2018","make":"McLaren","model":"Senna","year":2018,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"mercedes-amg-gt-black-series-2021","make":"Mercedes-AMG","model":"GT Black Series","year":2021,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Front","bodyType":"Supercar","driftFriendly":false},
{"id":"mercedes-benz-a-45-amg-2013","make":"Mercedes-Benz","model":"A 45 AMG","year":2013,"stockPI":700,"stockClass":"A","drivetrain":"AWD","engineLayout":"Front","bodyType":"Hatchback","driftFriendly":false},
{"id":"mercedes-benz-amg-clk-gtr-1998","make":"Mercedes-Benz","model":"AMG CLK GTR","year":1998,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"mercedes-benz-e-63-amg-2013","make":"Mercedes-Benz","model":"E 63 AMG","year":2013,"stockPI":800,"stockClass":"S1","drivetrain":"AWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":false},
{"id":"mercedes-benz-w154-1939","make":"Mercedes-Benz","model":"W154","year":1939,"stockPI":700,"stockClass":"A","drivetrain":"RWD","engineLayout":"Front","bodyType":"Classic","driftFriendly":false},
{"id":"mosler-mt900s-2010","make":"Mosler","model":"MT900S","year":2010,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"nissan-370z-nismo-2019","make":"Nissan","model":"370Z NISMO","year":2019,"stockPI":718,"stockClass":"A","drivetrain":"RWD","engineLayout":"Front","bodyType":"Coupe","driftFriendly":true},
{"id":"nissan-r390-gt1-1998","make":"Nissan","model":"R390 (GT1)","year":1998,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Supercar","driftFriendly":false},
{"id":"nissan-silvia-spec-r-2000","make":"Nissan","model":"Silvia Spec-R","year":2000,"stockPI":600,"stockClass":"C","drivetrain":"RWD","engineLayout":"Front","bodyType":"Coupe","driftFriendly":true},
{"id":"nissan-skyline-gt-r-v-spec-ii-2002","make":"Nissan","model":"Skyline GT-R Spec II","year":2002,"stockPI":700,"stockClass":"A","drivetrain":"AWD","engineLayout":"Front","bodyType":"Coupe","driftFriendly":false},
{"id":"pagani-zonda-r-2010","make":"Pagani","model":"Zonda R","year":2010,"stockPI":998,"stockClass":"S2","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Track Toy","driftFriendly":false},
{"id":"plymouth-barracuda-formula-s-1968","make":"Plymouth","model":"Barracuda S","year":1968,"stockPI":550,"stockClass":"C","drivetrain":"RWD","engineLayout":"Front","bodyType":"Muscle","driftFriendly":true},
{"id":"plymouth-cuda-426-hemi-1971","make":"Plymouth","model":"Cuda 426 HEMI","year":1971,"stockPI":600,"stockClass":"C","drivetrain":"RWD","engineLayout":"Front","bodyType":"Muscle","driftFriendly":true},
{"id":"pontiac-firebird-trans-am-sd-455-1973","make":"Pontiac","model":"Firebird Trans Am 455","year":1973,"stockPI":500,"stockClass":"D","drivetrain":"RWD","engineLayout":"Front","bodyType":"Muscle","driftFriendly":true},
{"id":"porsche-3-917-lh-1970","make":"Porsche","model":"#3 917 LH","year":1970,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Classic","driftFriendly":false},
{"id":"porsche-911-carrera-rs-1973","make":"Porsche","model":"911 Carrera RS","year":1973,"stockPI":600,"stockClass":"C","drivetrain":"RWD","engineLayout":"Rear","bodyType":"Classic","driftFriendly":false},
{"id":"porsche-911-gt2-1995","make":"Porsche","model":"911 GT2","year":1995,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Rear","bodyType":"Coupe","driftFriendly":false},
{"id":"porsche-911-gt2-rs-2018","make":"Porsche","model":"911 GT2 RS","year":2018,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Rear","bodyType":"Supercar","driftFriendly":false},
{"id":"porsche-911-gt3-2021","make":"Porsche","model":"911 GT3","year":2021,"stockPI":858,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Rear","bodyType":"Track Toy","driftFriendly":false},
{"id":"porsche-911-gt3-rs-2016","make":"Porsche","model":"911 GT3 RS","year":2016,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Rear","bodyType":"Track Toy","driftFriendly":false},
{"id":"porsche-911-gt3-rs-4-0-2012","make":"Porsche","model":"911 GT3 RS 4.0","year":2012,"stockPI":800,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Rear","bodyType":"Track Toy","driftFriendly":false},
{"id":"porsche-918-spyder-2014","make":"Porsche","model":"918 Spyder","year":2014,"stockPI":998,"stockClass":"S2","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"porsche-mission-r-2021","make":"Porsche","model":"Mission R","year":2021,"stockPI":900,"stockClass":"S1","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Track Toy","driftFriendly":false},
{"id":"rimac-concept-two-2019","make":"Rimac","model":"Concept Two","year":2019,"stockPI":998,"stockClass":"S2","drivetrain":"AWD","engineLayout":"Mid","bodyType":"Hypercar","driftFriendly":false},
{"id":"subaru-impreza-wrx-sti-2004","make":"Subaru","model":"Impreza WRX STi","year":2004,"stockPI":600,"stockClass":"C","drivetrain":"AWD","engineLayout":"Front","bodyType":"Sedan","driftFriendly":false},
{"id":"volvo-iron-knight-2016","make":"Volvo","model":"Iron Knight","year":2016,"stockPI":900,"stockClass":"S1","drivetrain":"RWD","engineLayout":"Mid","bodyType":"Truck","driftFriendly":false}
];

/* =============================================
 * STATE
 * ============================================= */
var db=null,seedCars=SEED_CARS,customCars=[],cars=SEED_CARS.slice(),
  currentCarId=null,currentDiscipline='road',activeFilter='all',searchQuery='',tunedCarIds={};

var DB_NAME='tunespec',DB_VERSION=1,STORE_USER='userData',STORE_CUSTOM='customCars';

/* =============================================
 * IndexedDB
 * ============================================= */
function openDb(){
  return new Promise(function(resolve,reject){
    var req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=function(e){
      var d=e.target.result;
      if(!d.objectStoreNames.contains(STORE_USER))d.createObjectStore(STORE_USER,{keyPath:'carId'});
      if(!d.objectStoreNames.contains(STORE_CUSTOM))d.createObjectStore(STORE_CUSTOM,{keyPath:'id'});
    };
    req.onsuccess=function(e){db=e.target.result;resolve(db);};
    req.onerror=function(e){reject(e.target.error);};
  });
}
function dbGet(s,k){return new Promise(function(res,rej){var tx=db.transaction(s,'readonly');var r=tx.objectStore(s).get(k);r.onsuccess=function(){res(r.result||null);};r.onerror=function(e){rej(e.target.error);};});}
function dbGetAll(s){return new Promise(function(res,rej){var tx=db.transaction(s,'readonly');var r=tx.objectStore(s).getAll();r.onsuccess=function(){res(r.result||[]);};r.onerror=function(e){rej(e.target.error);};});}
function dbPut(s,v){return new Promise(function(res,rej){var tx=db.transaction(s,'readwrite');tx.objectStore(s).put(v);tx.oncomplete=function(){res(true);};tx.onerror=function(e){rej(e.target.error);};});}
function dbDelete(s,k){return new Promise(function(res,rej){var tx=db.transaction(s,'readwrite');tx.objectStore(s).delete(k);tx.oncomplete=function(){res(true);};tx.onerror=function(e){rej(e.target.error);};});}

/* =============================================
 * USER DATA
 * ============================================= */
function defaultCompound(d){return({drift:'sport',road:'race',dirt:'rally',drag:'drag'})[d]||'race';}
function defaultTrans(d){return({drift:'race',road:'race',dirt:'race',drag:'drag'})[d]||'race';}

function getUserData(carId){
  return dbGet(STORE_USER,carId).then(function(e){
    if(!e)e={carId:carId,weight:null,fwd:null,power:null,drivetrainOverride:null,notes:'',tunes:{},lastDiscipline:'road'};
    return e;
  });
}
function saveUserData(e){return dbPut(STORE_USER,e);}
function buildTunedSet(){
  return dbGetAll(STORE_USER).then(function(all){
    tunedCarIds={};all.forEach(function(e){if(e.weight&&e.fwd)tunedCarIds[e.carId]=true;});
  });
}

/* =============================================
 * TUNE CALCULATOR
 * ============================================= */
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function r1(v){return Math.round(v*10)/10;}
function r2(v){return Math.round(v*100)/100;}
function ri(v){return Math.round(v);}
function springFromFreq(hz,cw){return(hz*hz*cw*4*Math.PI*Math.PI)/386.088;}
function targetFreqs(d,c){
  if(d==='road'){if(c==='slick-race'||c==='semi-slick')return[2.6,3.0];if(c==='sport'||c==='street')return[2.1,2.4];return[1.8,2.1];}
  if(d==='drift')return[2.5,1.7];if(d==='dirt')return[1.4,1.6];if(d==='drag')return[1.7,1.2];return[2.0,2.2];
}
function pwTier(hp,wt){if(!hp||!wt)return'unknown';var r=hp/wt;if(r<0.10)return'low';if(r<0.20)return'balanced';if(r<0.30)return'high';return'extreme';}

function calcRoad(c){
  var cwF=(c.weight*c.fwd/100)/2,cwR=(c.weight*(100-c.fwd)/100)/2,f=targetFreqs('road',c.compound);
  var sF=ri(springFromFreq(f[0],cwF)),sR=ri(springFromFreq(f[1],cwR));
  var rebF=clamp(sF/100,7,13),rebR=clamp(sR/100,7,13),bF=rebF*0.65,bR=rebR*0.65;
  var fd=c.fwd-50,arbF=clamp(32+fd*0.5,22,45),arbR=clamp(30-fd*0.5,20,42);
  if(c.drivetrain==='FWD'){arbF-=4;arbR+=4;}if(c.drivetrain==='AWD')arbF+=1;
  if(c.drivetrain==='MR'||c.drivetrain==='RR'){arbF+=3;arbR-=3;}
  var pF=30,pR=30;if(c.drivetrain==='AWD'||c.drivetrain==='FWD')pF--;if(c.drivetrain==='MR'||c.drivetrain==='RR'){pF++;pR--;}
  if(c.weight>3500){pF--;pR--;}if(c.weight>4200){pF--;pR--;}
  var camF=-2.0,camR=-1.5;if(c.drivetrain==='MR'||c.drivetrain==='RR'){camF+=0.3;camR-=0.3;}
  var diff;
  if(c.drivetrain==='RWD'||c.drivetrain==='MR'||c.drivetrain==='RR'){var a=55;if(c.tier==='high')a=65;if(c.tier==='extreme')a=75;diff={rearAccel:a,rearDecel:20};}
  else if(c.drivetrain==='AWD'){var rwd=25;if(c.tier==='high')rwd=35;if(c.tier==='extreme')rwd=45;diff={frontAccel:30,frontDecel:5,rearAccel:clamp(rwd+50,50,90),rearDecel:20,center:c.tier==='extreme'?65:70};}
  else diff={frontAccel:40,frontDecel:10};
  var aF='mid',aR='mid';if(c.tier==='extreme'){aF='mid-high';aR='max';}
  return{tirePressure:{front:r1(pF),rear:r1(pR)},camber:{front:r1(camF),rear:r1(camR)},toe:{front:0,rear:0},caster:5.5,arb:{front:r1(arbF),rear:r1(arbR)},springs:{front:sF,rear:sR,unit:'lb/in'},rideHeight:{front:'min+0.4"',rear:'min+0.4"'},damping:{rebound:{front:r1(rebF),rear:r1(rebR)},bump:{front:r1(bF),rear:r1(bR)}},differential:diff,brakes:{balance:52,pressure:100},aero:{front:aF,rear:aR},gearing:'3.0-3.5 (technical), 2.5-2.8 (high speed)'};
}

function calcDrift(c){
  var cwF=(c.weight*c.fwd/100)/2,cwR=(c.weight*(100-c.fwd)/100)/2,f=targetFreqs('drift',c.compound);
  var sF=ri(springFromFreq(f[0],cwF)),sR=ri(springFromFreq(f[1],cwR));
  var rebF=clamp(sF/110,6,10),rebR=clamp(sR/110,4,8),bF=rebF*0.65,bR=rebR*0.65;
  var arbF=clamp(40+(c.fwd-50)*0.4,30,50),arbR=12;
  var diff;if(c.drivetrain==='AWD')diff={frontAccel:50,frontDecel:0,rearAccel:100,rearDecel:20,center:90};
  else if(c.drivetrain==='FWD')diff={frontAccel:100,frontDecel:0};else diff={rearAccel:100,rearDecel:20};
  var g=c.transmission==='race'?'Final 3.5-4.0 (zones), 2.5-3.0 (links)':c.transmission==='drift'?'Drift trans fixed ratios. Race trans recommended.':'Use Race or Drift trans.';
  return{tirePressure:{front:30,rear:38},camber:{front:-4.0,rear:-0.3},toe:{front:0.2,rear:-0.2},caster:7.0,arb:{front:r1(arbF),rear:r1(arbR)},springs:{front:sF,rear:sR,unit:'lb/in'},rideHeight:{front:'min+0.6"',rear:'min+0.2"'},damping:{rebound:{front:r1(rebF),rear:r1(rebR)},bump:{front:r1(bF),rear:r1(bR)}},differential:diff,brakes:{balance:62,pressure:100},aero:{front:'min',rear:'max (if equipped)'},gearing:g};
}

function calcDirt(c){
  var cwF=(c.weight*c.fwd/100)/2,cwR=(c.weight*(100-c.fwd)/100)/2,f=targetFreqs('dirt',null);
  var sF=ri(springFromFreq(f[0],cwF)),sR=ri(springFromFreq(f[1],cwR));
  var rebF=clamp(sF/130,3,7),rebR=clamp(sR/130,3,7),bF=rebF*0.65,bR=rebR*0.65;
  var arbF=clamp(14+(c.fwd-50)*0.3,8,20),arbR=clamp(14-(c.fwd-50)*0.3,8,20);
  var diff;if(c.drivetrain==='AWD')diff={frontAccel:40,frontDecel:10,rearAccel:70,rearDecel:25,center:58};
  else if(c.drivetrain==='FWD')diff={frontAccel:45,frontDecel:10};else diff={rearAccel:65,rearDecel:25};
  return{tirePressure:{front:25,rear:25},camber:{front:-1.2,rear:-1.0},toe:{front:0,rear:-0.2},caster:5.0,arb:{front:r1(arbF),rear:r1(arbR)},springs:{front:sF,rear:sR,unit:'lb/in'},rideHeight:{front:'max-0.5"',rear:'max-0.5"'},damping:{rebound:{front:r1(rebF),rear:r1(rebR)},bump:{front:r1(bF),rear:r1(bR)}},differential:diff,brakes:{balance:50,pressure:95},aero:{front:'min',rear:'mid-high'},gearing:'Final 3.0-3.5'};
}

function calcDrag(c){
  var cwF=(c.weight*c.fwd/100)/2,cwR=(c.weight*(100-c.fwd)/100)/2,f=targetFreqs('drag',null);
  var sF=ri(springFromFreq(f[0],cwF)),sR=ri(springFromFreq(f[1],cwR));
  var rebF=clamp(sF/130,4,8),rebR=clamp(sR/200,2,5),bF=rebF*0.65,bR=rebR*0.6;
  var diff;if(c.drivetrain==='AWD')diff={frontAccel:90,frontDecel:0,rearAccel:100,rearDecel:0,center:55};
  else if(c.drivetrain==='FWD')diff={frontAccel:100,frontDecel:0};else diff={rearAccel:100,rearDecel:0};
  return{tirePressure:{front:30,rear:24},camber:{front:0,rear:0.2},toe:{front:0,rear:0.1},caster:7.0,arb:{front:1,rear:1},springs:{front:sF,rear:sR,unit:'lb/in'},rideHeight:{front:'min',rear:'min+0.6"'},damping:{rebound:{front:r1(rebF),rear:r1(rebR)},bump:{front:r1(bF),rear:r1(bR)}},differential:diff,brakes:{balance:50,pressure:100},aero:{front:'strip/min',rear:'strip/min'},gearing:'Drag trans preferred. Race: lengthen 1st (~2.7).'};
}

function generateWarnings(c,d){
  var w=[];
  if(!c.hp)w.push({lv:'info',msg:'Set power (hp) for P/W and diff recommendations.'});
  if(c.hp&&c.weight){var pw=c.hp/c.weight;
    if(d==='drift'&&c.hp>650)w.push({lv:'warn',msg:c.hp+' hp exceeds ~600 hp drift sweet spot.'});
    if(c.tier==='extreme')w.push({lv:'warn',msg:'Extreme P/W ('+pw.toFixed(2)+' hp/lb). Aero doubled.'});
    if(d==='road'&&c.hp>600&&(c.drivetrain==='RWD'||c.drivetrain==='MR'))w.push({lv:'info',msg:'High-power RWD: AWD conversion is the FH5 meta.'});
  }
  if(d==='drift'&&c.transmission==='drift')w.push({lv:'info',msg:'Drift trans = beginner. Race trans for competitive zones.'});
  if(c.transmission==='sport')w.push({lv:'warn',msg:'Sport trans = partial tuning only. Never for serious builds.'});
  if(d==='drift'&&c.compound==='drift')w.push({lv:'info',msg:'Drift compound scores LOWER than Sport/Race on zones. Sport recommended.'});
  if(d==='dirt'&&['street','sport','semi-slick','slick-race','drag','drift'].indexOf(c.compound)>=0)w.push({lv:'warn',msg:'Wrong tires for dirt. Use Rally or Off-road.'});
  if(d==='drift'&&c.drivetrain==='FWD')w.push({lv:'warn',msg:'FWD drift = meme. RWD conversion required.'});
  return w;
}

function calcTune(input){
  var c={weight:Number(input.weight)||3000,fwd:Number(input.fwd)||50,hp:input.hp?Number(input.hp):null,
    drivetrain:input.drivetrain||'RWD',compound:input.compound||defaultCompound(input.discipline),
    transmission:input.transmission||defaultTrans(input.discipline)};
  c.tier=pwTier(c.hp,c.weight);
  var r;switch(input.discipline){case'drift':r=calcDrift(c);break;case'dirt':r=calcDirt(c);break;case'drag':r=calcDrag(c);break;default:r=calcRoad(c);}
  r.warnings=generateWarnings(c,input.discipline);
  r.meta={pwRatio:c.hp?r2(c.hp/c.weight):null,tier:c.tier,drivetrain:c.drivetrain,compound:c.compound,transmission:c.transmission};
  return r;
}

/* =============================================
 * GLOSSARY
 * ============================================= */
var GLOSSARY=[
{key:'TIRE_COMPOUND',title:'Tire Compound',body:"FH5 DRIFT CORRECTION: drift compound scores LOWER than Sport/Race on zones. Sport = recommended for points. Drift = casual/smoke.\n\nRoad: Slick Race or Semi-Slick universal. Dirt: Rally (mixed) or Off-road. Drag: Drag tires required."},
{key:'TIRE_PRESSURE',title:'Tire Pressure',body:"Lower psi = more grip, more heat. Heavy cars: drop 1-2 psi.\nDrift: high rear (35-40+) for rotation. Drag: low rear (~24) for launch. Dirt: low both (~25)."},
{key:'CAMBER',title:'Camber',body:"MYTH: max camber = max grip. NO. Road: -1.5 to -2.5 front. Drift: -3 to -5 front, near 0 rear."},
{key:'TOE',title:'Toe',body:"FH5: leave at 0.0 in nearly all cases. ForzaTune ML confirms. Drift: small front toe-out (+0.2) for initiation."},
{key:'CASTER',title:'Caster',body:"Higher = more stability. Most tunes ~5.5. Drift/drag max at 7.0."},
{key:'ARB',title:'Anti-Roll Bars',body:"FIRST lever for understeer/oversteer. Soften front ARB = less understeer. Soften rear = less oversteer. Drive axle wants softer ARB."},
{key:'SPRINGS',title:'Springs',body:"Natural frequency formula: Rate = (freq^2 x cornerWeight x 4pi^2) / 386.088\nFlat-ride: rear ~15% stiffer frequency."},
{key:'RIDE_HEIGHT',title:'Ride Height',body:"MYTH: slammed = fastest. NO. Mexico is bumpy. Road: min+0.3-0.7\". DRIFT MYTH: slam for drift. NO. Slight rake helps initiation."},
{key:'DAMPING',title:'Damping',body:"RULE: Bump = 60-70% of Rebound. Equal = harsh. Rebound scales with spring rate."},
{key:'DIFFERENTIAL',title:'Differential',body:"IN-GAME HELP IS WRONG on decel. Higher decel = MORE stability, not less.\nFH5 AWD: Race diff rear accel = RWD value + 50%."},
{key:'BRAKES',title:'Brakes',body:"Balance: 50-55% front for road. Drift: 55-70% front. Trail-brake: 48-50%."},
{key:'AERO',title:'Aero',body:"Aero scales with speed^2. Below 60mph: useless. Extreme power: double downforce. Drag: strip all."},
{key:'GEARING',title:'Gearing & Transmission',body:"Race trans: Road, Dirt, COMPETITIVE DRIFT. Drift trans: beginner drift. Drag trans: drag. Sport: NEVER.\nDrift zones: final 3.5-4.5. Links: 2.5-3.5."},
{key:'POWER_TO_WEIGHT',title:'Power-to-Weight',body:"<0.10: soft springs. 0.10-0.20: standard. 0.20-0.30: stiffen rear. >0.30: extreme, 2x downforce.\nDrift: keep power <= ~600 hp."},
{key:'CONTROLLER',title:'Controller Linearity',body:"BACKWARDS FROM WHAT YOU THINK. Linearity < 50 = LESS twitchy center. > 50 = MORE twitchy. 45 for road/dirt, 50 for drift/drag."}
];

/* =============================================
 * FH5 TIRE COMPOUND OPTIONS (matches in-game names)
 * ============================================= */
var TIRE_OPTS=[['stock','Stock'],['street','Street'],['sport','Sport'],['semi-slick','Semi-Slick Race'],['slick-race','Slick Race'],['drift','Drift'],['rally','Rally'],['offroad','Off-Road'],['snow','Snow'],['drag','Drag']];
var TRANS_OPTS=[['sport','Sport'],['race','Race'],['drift','Drift'],['drag','Drag']];

/* =============================================
 * UI HELPERS
 * ============================================= */
function esc(s){return s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function debounce(fn,ms){var t;return function(){var a=arguments,c=this;clearTimeout(t);t=setTimeout(function(){fn.apply(c,a);},ms);};}
function parseNum(id){var el=document.getElementById(id);return el?(parseFloat(el.value)||null):null;}
function inputField(lbl,id,val,ph){var v=val!=null?val:'';var tp=(typeof val==='number'||(ph&&/^\d/.test(ph)))?'number':'text';return'<label class="field"><span class="field-label">'+esc(lbl)+'</span><input type="'+tp+'" id="'+id+'" value="'+esc(''+v)+'" placeholder="'+esc(ph)+'"></label>';}
function selectField(lbl,id,val,opts){return'<label class="field"><span class="field-label">'+esc(lbl)+'</span><select id="'+id+'">'+opts.map(function(o){return'<option value="'+esc(o[0])+'"'+(String(val)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></label>';}
function tuneRow(l,v){return'<div class="tune-row"><span>'+esc(l)+'</span><span>'+v+'</span></div>';}
function tuneSection(t,gk,rows){return'<div class="tune-sect"><div class="tune-sect-head"><span>'+esc(t)+'</span><button class="gl-btn" data-key="'+gk+'">?</button></div>'+rows.join('')+'</div>';}

/* =============================================
 * CAR LIST
 * ============================================= */
function renderCarList(){
  var $count=document.getElementById('count'),$list=document.getElementById('car-list');
  var list=cars.slice();
  if(searchQuery){var q=searchQuery.toLowerCase();list=list.filter(function(c){return(c.make+' '+c.model+' '+c.year).toLowerCase().indexOf(q)>=0;});}
  if(activeFilter==='drift')list=list.filter(function(c){return c.driftFriendly;});
  else if(activeFilter==='rwd')list=list.filter(function(c){return c.drivetrain==='RWD';});
  else if(activeFilter==='awd')list=list.filter(function(c){return c.drivetrain==='AWD';});
  else if(activeFilter==='fwd')list=list.filter(function(c){return c.drivetrain==='FWD';});
  else if(activeFilter==='muscle')list=list.filter(function(c){return(c.bodyType||'').toLowerCase().indexOf('muscle')>=0;});
  else if(activeFilter==='tuned')list=list.filter(function(c){return tunedCarIds[c.id];});
  list.sort(function(a,b){return(a.make+a.model).localeCompare(b.make+b.model);});
  $count.textContent=list.length+' car'+(list.length!==1?'s':'');
  if(!list.length){$list.innerHTML='<div style="text-align:center;color:var(--text-dim,#888);padding:40px 0;">No cars match.</div>';return;}
  $list.innerHTML=list.map(function(c){
    var dt=(c.drivetrain||'rwd').toLowerCase(),star=c.driftFriendly?' <span class="drift-star">\u2605</span>':'';
    return'<div class="car-row" data-id="'+c.id+'"><div><div class="name">'+esc(c.year)+' '+esc(c.make)+' '+esc(c.model)+star+'</div><div class="sub">'+esc(c.stockClass||'')+' \u00b7 '+esc(c.bodyType||'')+'</div></div><span class="badge '+dt+'">'+esc(c.drivetrain)+'</span></div>';
  }).join('');
  $list.querySelectorAll('.car-row').forEach(function(el){el.addEventListener('click',function(){openCarModal(el.dataset.id);});});
}

/* =============================================
 * CAR DETAIL MODAL
 * ============================================= */
function openCarModal(carId){
  currentCarId=carId;
  var car=cars.filter(function(c){return c.id===carId;})[0];
  if(!car)return;
  getUserData(carId).then(function(ud){
    if(ud.lastDiscipline)currentDiscipline=ud.lastDiscipline;
    renderModal(car,ud);
    document.getElementById('modal').classList.add('open');
  });
}

function renderModal(car,ud){
  var mc=document.getElementById('modal-content'),disc=currentDiscipline;
  var tune=ud.tunes&&ud.tunes[disc]||{};
  var compound=tune.tireCompound||defaultCompound(disc);
  var transmission=tune.transmissionType||defaultTrans(disc);
  var drivetrain=ud.drivetrainOverride||car.drivetrain;
  var delBtn=car.custom?' <button class="btn-sm btn-danger" id="md-delete">Delete</button>':'';

  mc.innerHTML='<h2>'+esc(car.year)+' '+esc(car.make)+' '+esc(car.model)+'</h2>'+
    '<div style="margin:-8px 0 12px;font-size:12px;color:var(--text-dim,#888);">'+esc(car.stockClass)+' \u00b7 '+esc(car.drivetrain)+' \u00b7 '+esc(car.bodyType||'')+' \u00b7 '+esc(car.engineLayout||'')+delBtn+'</div>'+
    '<div class="input-grid">'+inputField('Weight (lb)','md-weight',ud.weight,'3000')+inputField('Front wt %','md-fwd',ud.fwd,'52')+inputField('Power (hp)','md-power',ud.power,'550')+
    selectField('Drivetrain','md-dt',ud.drivetrainOverride||'',[['',car.drivetrain+' (stock)'],['RWD','RWD (conv)'],['AWD','AWD (conv)'],['FWD','FWD'],['MR','Mid-engine RWD'],['RR','Rear-engine RWD']])+'</div>'+
    '<div class="disc-tabs">'+['road','drift','dirt','drag'].map(function(d){return'<button class="disc-tab'+(d===disc?' active':'')+'" data-disc="'+d+'">'+d.toUpperCase()+'</button>';}).join('')+'</div>'+
    '<div class="disc-inputs">'+selectField('Tires','md-compound',compound,TIRE_OPTS)+
    selectField('Trans','md-trans',transmission,TRANS_OPTS)+'</div>'+
    '<div id="tune-output"></div>'+
    '<div class="notes-field"><label style="font-size:12px;color:var(--text-dim,#888);">NOTES</label><textarea id="md-notes" rows="3" placeholder="Personal notes...">'+esc(ud.notes||'')+'</textarea></div>';

  // Render tune output separately (so we can update it without nuking the form)
  updateTuneOutput();

  // Discipline tabs — full re-render needed (changes which inputs are relevant)
  mc.querySelectorAll('.disc-tab').forEach(function(t){t.addEventListener('click',function(){
    currentDiscipline=t.dataset.disc;getUserData(currentCarId).then(function(f){f.lastDiscipline=currentDiscipline;saveUserData(f);renderModal(car,f);});
  });});

  // Input changes — save to DB + update ONLY the tune output (NOT full modal)
  var saveAndUpdate=debounce(function(){
    getUserData(currentCarId).then(function(f){
      f.weight=parseNum('md-weight');f.fwd=parseNum('md-fwd');f.power=parseNum('md-power');
      f.drivetrainOverride=document.getElementById('md-dt').value||null;
      if(!f.tunes)f.tunes={};if(!f.tunes[currentDiscipline])f.tunes[currentDiscipline]={};
      f.tunes[currentDiscipline].tireCompound=document.getElementById('md-compound').value;
      f.tunes[currentDiscipline].transmissionType=document.getElementById('md-trans').value;
      f.lastDiscipline=currentDiscipline;
      saveUserData(f).then(function(){buildTunedSet();updateTuneOutput();});
    });
  },400);

  ['md-weight','md-fwd','md-power','md-dt','md-compound','md-trans'].forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    el.addEventListener('change',saveAndUpdate);
    if(el.tagName==='INPUT')el.addEventListener('input',saveAndUpdate);
  });

  // Notes — save without any re-render
  var ne=document.getElementById('md-notes');
  if(ne)ne.addEventListener('input',debounce(function(){getUserData(currentCarId).then(function(f){f.notes=ne.value;saveUserData(f);});},500));

  // Delete custom car
  var del=document.getElementById('md-delete');if(del)del.addEventListener('click',function(){
    if(!confirm('Delete this car and all saved tunes?'))return;
    dbDelete(STORE_CUSTOM,currentCarId).then(function(){return dbDelete(STORE_USER,currentCarId);}).then(function(){
      customCars=customCars.filter(function(c){return c.id!==currentCarId;});cars=seedCars.concat(customCars);currentCarId=null;
      document.getElementById('modal').classList.remove('open');buildTunedSet().then(renderCarList);
    });
  });

  // Glossary buttons
  mc.querySelectorAll('.gl-btn').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();showGlossary(b.dataset.key);});});
}

/* KEY FIX: This function ONLY updates #tune-output, does NOT destroy the form inputs */
function updateTuneOutput(){
  var out=document.getElementById('tune-output');if(!out)return;
  var car=cars.filter(function(c){return c.id===currentCarId;})[0];if(!car)return;
  var wt=parseNum('md-weight'),fw=parseNum('md-fwd'),hp=parseNum('md-power');
  var dt=document.getElementById('md-dt');var drivetrain=(dt&&dt.value)||car.drivetrain;
  var cp=document.getElementById('md-compound');var compound=(cp&&cp.value)||defaultCompound(currentDiscipline);
  var tr=document.getElementById('md-trans');var transmission=(tr&&tr.value)||defaultTrans(currentDiscipline);

  if(!wt||!fw){out.innerHTML='<div style="color:var(--text-dim,#888);padding:20px 0;text-align:center;">Enter weight + front wt% to calculate.</div>';return;}
  var result=calcTune({weight:wt,fwd:fw,hp:hp,drivetrain:drivetrain,compound:compound,transmission:transmission,discipline:currentDiscipline});
  out.innerHTML=renderTuneOutput(result);
  // Re-bind glossary buttons inside the new output
  out.querySelectorAll('.gl-btn').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();showGlossary(b.dataset.key);});});
}

function renderTuneOutput(r){
  var h='';
  if(r.warnings.length)h+='<div class="warnings">'+r.warnings.map(function(w){return'<div class="warn-'+w.lv+'">'+esc(w.msg)+'</div>';}).join('')+'</div>';
  h+='<div class="tune-meta">'+(r.meta.pwRatio?'P/W: '+r.meta.pwRatio+' ('+r.meta.tier+')':'P/W: not set')+' \u00b7 '+r.meta.drivetrain+' \u00b7 '+r.meta.compound+' \u00b7 '+r.meta.transmission+'</div>';
  h+=tuneSection('Tires','TIRE_PRESSURE',[tuneRow('Front',r.tirePressure.front+' psi'),tuneRow('Rear',r.tirePressure.rear+' psi')]);
  h+=tuneSection('Alignment','CAMBER',[tuneRow('Camber F/R',r.camber.front+'\u00b0 / '+r.camber.rear+'\u00b0'),tuneRow('Toe F/R',r.toe.front+'\u00b0 / '+r.toe.rear+'\u00b0'),tuneRow('Caster',r.caster+'\u00b0')]);
  h+=tuneSection('ARBs','ARB',[tuneRow('Front',r.arb.front),tuneRow('Rear',r.arb.rear)]);
  h+=tuneSection('Springs','SPRINGS',[tuneRow('Front',r.springs.front+' '+r.springs.unit),tuneRow('Rear',r.springs.rear+' '+r.springs.unit),tuneRow('Ride Height',esc(r.rideHeight.front)+' / '+esc(r.rideHeight.rear))]);
  h+=tuneSection('Damping','DAMPING',[tuneRow('Rebound F/R',r.damping.rebound.front+' / '+r.damping.rebound.rear),tuneRow('Bump F/R',r.damping.bump.front+' / '+r.damping.bump.rear)]);
  var d=r.differential,dr=[];
  if(d.frontAccel!=null)dr.push(tuneRow('Front Accel',d.frontAccel+'%'));if(d.frontDecel!=null)dr.push(tuneRow('Front Decel',d.frontDecel+'%'));
  if(d.rearAccel!=null)dr.push(tuneRow('Rear Accel',d.rearAccel+'%'));if(d.rearDecel!=null)dr.push(tuneRow('Rear Decel',d.rearDecel+'%'));
  if(d.center!=null)dr.push(tuneRow('Center (% rear)',d.center+'%'));
  h+=tuneSection('Differential','DIFFERENTIAL',dr);
  h+=tuneSection('Brakes','BRAKES',[tuneRow('Balance',r.brakes.balance+'% front'),tuneRow('Pressure',r.brakes.pressure+'%')]);
  h+=tuneSection('Aero','AERO',[tuneRow('Front',esc(r.aero.front)),tuneRow('Rear',esc(r.aero.rear))]);
  h+=tuneSection('Gearing','GEARING',['<div style="padding:6px 10px;font-size:13px;">'+esc(r.gearing)+'</div>']);
  return h;
}

/* =============================================
 * GLOSSARY + ADD CAR
 * ============================================= */
function showGlossary(fk){
  var g=document.createElement('div');g.className='modal open';g.style.cssText='z-index:200;align-items:flex-end;';
  g.innerHTML='<div class="modal-body" style="max-height:90vh;"><button class="close-x" id="gl-close">\u2715</button><h2>Glossary</h2>'+GLOSSARY.map(function(e){
    return'<div id="gl-'+e.key+'" style="border-bottom:1px solid var(--border,#333);padding:8px 0;"><h3 style="margin:8px 0 4px;font-size:15px;color:var(--accent-2,#ff6b00);">'+esc(e.title)+'</h3><div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">'+esc(e.body)+'</div></div>';
  }).join('')+'</div>';
  document.body.appendChild(g);
  g.querySelector('#gl-close').addEventListener('click',function(){g.remove();});
  g.addEventListener('click',function(e){if(e.target===g)g.remove();});
  if(fk){var el=g.querySelector('#gl-'+fk);if(el)setTimeout(function(){el.scrollIntoView({block:'start'});},50);}
}

function showAddCar(){
  var mc=document.getElementById('modal-content');
  mc.innerHTML='<h2>Add Custom Car</h2><div class="input-grid">'+inputField('Make','ac-make','','Nissan')+inputField('Model','ac-model','','Silvia')+inputField('Year','ac-year',2020,'1994')+
    selectField('Drivetrain','ac-dt','RWD',[['RWD','RWD'],['AWD','AWD'],['FWD','FWD']])+
    selectField('Class','ac-class','A',[['D','D'],['C','C'],['B','B'],['A','A'],['S1','S1'],['S2','S2'],['X','X']])+
    inputField('Body','ac-body','','Coupe')+inputField('Engine','ac-engine','','Front')+'</div>'+
    '<label style="display:flex;gap:8px;margin:12px 0;font-size:13px;"><input type="checkbox" id="ac-drift"> Drift-friendly</label>'+
    '<button class="btn-primary" id="ac-save">Save</button>';
  document.getElementById('modal').classList.add('open');
  document.getElementById('ac-save').addEventListener('click',function(){
    var mk=document.getElementById('ac-make').value.trim(),md=document.getElementById('ac-model').value.trim();
    if(!mk||!md){alert('Make and model required.');return;}
    var nc={id:'custom_'+Date.now(),make:mk,model:md,year:parseInt(document.getElementById('ac-year').value)||2020,
      drivetrain:document.getElementById('ac-dt').value,stockClass:document.getElementById('ac-class').value,
      bodyType:document.getElementById('ac-body').value.trim(),engineLayout:document.getElementById('ac-engine').value.trim(),
      driftFriendly:document.getElementById('ac-drift').checked,custom:true};
    dbPut(STORE_CUSTOM,nc).then(function(){customCars.push(nc);cars=seedCars.concat(customCars);document.getElementById('modal').classList.remove('open');renderCarList();});
  });
}

/* =============================================
 * INJECTED STYLES
 * ============================================= */
function injectStyles(){
  if(document.getElementById('ts3css'))return;var s=document.createElement('style');s.id='ts3css';
  s.textContent='.input-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.field{display:flex;flex-direction:column;gap:3px}.field-label{font-size:11px;color:var(--text-dim,#888);text-transform:uppercase;letter-spacing:.6px}.field input,.field select{background:var(--bg-card,#1a1a1a);border:1px solid var(--border,#333);color:var(--text,#eee);border-radius:6px;padding:8px 10px;font-size:14px;font-family:var(--mono,monospace)}.field input:focus,.field select:focus{border-color:var(--accent,#e10600);outline:none}.disc-tabs{display:flex;gap:4px;margin:14px 0 10px}.disc-tab{flex:1;padding:8px 4px;border:1px solid var(--border,#333);background:var(--bg-card,#1a1a1a);color:var(--text-dim,#888);border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.8px;cursor:pointer;text-align:center}.disc-tab.active{background:var(--accent,#e10600);border-color:var(--accent,#e10600);color:#fff}.disc-inputs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}.tune-meta{font-size:11px;color:var(--text-dim,#888);background:var(--bg-card,#1a1a1a);border:1px solid var(--border,#333);border-radius:6px;padding:8px 10px;margin-bottom:10px;font-family:var(--mono,monospace)}.warnings{margin-bottom:10px}.warn-info{background:rgba(0,150,255,.1);border:1px solid rgba(0,150,255,.25);color:#6cb4ff;border-radius:6px;padding:8px 10px;font-size:12px;margin-bottom:6px;line-height:1.4}.warn-warn{background:rgba(255,170,0,.1);border:1px solid rgba(255,170,0,.25);color:#ffb84d;border-radius:6px;padding:8px 10px;font-size:12px;margin-bottom:6px;line-height:1.4}.tune-sect{margin-bottom:8px;border:1px solid var(--border,#333);border-radius:6px;overflow:hidden}.tune-sect-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg-card,#1a1a1a);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-dim,#888)}.gl-btn{background:none;border:1px solid var(--border,#333);color:var(--accent-2,#ff6b00);border-radius:50%;width:22px;height:22px;font-size:12px;font-weight:700;cursor:pointer;padding:0;line-height:20px;text-align:center}.tune-row{display:flex;justify-content:space-between;padding:6px 10px;font-size:13px;border-top:1px solid var(--border,#333)}.tune-row span:last-child{font-family:var(--mono,monospace);font-weight:700}.btn-sm{font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid;cursor:pointer;background:none;margin-left:8px}.btn-danger{border-color:var(--accent,#e10600);color:var(--accent,#e10600)}.btn-primary{width:100%;padding:12px;background:var(--accent,#e10600);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}.topbar-actions{display:flex;gap:8px;margin-left:auto}.topbar-btn{background:none;border:1px solid var(--border,#333);color:var(--text-dim,#888);border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}';
  document.head.appendChild(s);
}

/* =============================================
 * BOOT
 * ============================================= */
document.addEventListener('DOMContentLoaded',function(){
  injectStyles();
  var $list=document.getElementById('car-list');
  function showErr(msg){$list.innerHTML='<div style="color:#ff4444;padding:20px;font-size:14px;word-break:break-all;">ERROR: '+esc(msg)+'</div>';}

  try{
    var sub=document.querySelector('.brand-sub');if(sub)sub.textContent='Tuning Calculator \u00b7 Pick a Car';
    var hdr=document.querySelector('.topbar');
    if(hdr&&!document.getElementById('topbar-actions')){
      var act=document.createElement('div');act.id='topbar-actions';act.className='topbar-actions';
      act.innerHTML='<button class="topbar-btn" id="btn-glossary">?</button><button class="topbar-btn" id="btn-add-car">+ Car</button>';
      hdr.appendChild(act);
      document.getElementById('btn-glossary').addEventListener('click',function(){showGlossary();});
      document.getElementById('btn-add-car').addEventListener('click',function(){showAddCar();});
    }
    document.getElementById('search').addEventListener('input',debounce(function(e){searchQuery=e.target.value;renderCarList();},200));
    document.getElementById('filters').querySelectorAll('.chip').forEach(function(chip){
      chip.addEventListener('click',function(){
        document.getElementById('filters').querySelectorAll('.chip').forEach(function(c){c.classList.remove('active');});
        chip.classList.add('active');activeFilter=chip.dataset.filter;renderCarList();
      });
    });
    var modal=document.getElementById('modal'),closeBtn=document.getElementById('close');
    closeBtn.addEventListener('click',function(){modal.classList.remove('open');currentCarId=null;renderCarList();});
    modal.addEventListener('click',function(e){if(e.target===modal){modal.classList.remove('open');currentCarId=null;renderCarList();}});

    cars=seedCars.slice();
    renderCarList();

    openDb().then(function(){return dbGetAll(STORE_CUSTOM);}).then(function(cc){
      customCars=cc;cars=seedCars.concat(customCars);return buildTunedSet();
    }).then(function(){renderCarList();}).catch(function(e){console.error('DB error:',e);});
  }catch(e){showErr(e.message||String(e));console.error(e);}
});
