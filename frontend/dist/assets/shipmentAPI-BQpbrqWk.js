import{e}from"./index-BD8idJkf.js";const n={list:()=>e.get("/shipments"),create:t=>e.post("/shipments",t),update:(t,s)=>e.patch(`/shipments/${encodeURIComponent(t)}`,s)};export{n as S};
