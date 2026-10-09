import {createServer} from 'node:http';
let mode='internal';
const requests=[];
createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 res.setHeader('Content-Type','application/json');
 if(url.pathname==='/mode'){mode=url.searchParams.get('value')||mode;res.end(JSON.stringify(mode));return;}
 if(url.pathname==='/requests'){res.end(JSON.stringify(requests));return;}
 requests.push({method:req.method,path:url.pathname});
 if(url.pathname==='/rest/v1/rpc/get_panel_release_mode'){res.end(JSON.stringify(mode));return;}
 if(url.pathname==='/rest/v1/rpc/get_public_panel_program'){res.end(JSON.stringify([{panel_id:'synthetic',title:'Panel sintetico riservato',description:'Programma conservato',starts_at:'2026-10-25T09:00:00Z',ends_at:'2026-10-25T10:00:00Z',location_name:'Sala sintetica',location_address:null,availability:'available'}]));return;}
 res.statusCode=500;res.end(JSON.stringify({code:'UNEXPECTED',message:'Unexpected synthetic request'}));
}).listen(55440,'127.0.0.1',()=>console.log('Local synthetic service ready'));
