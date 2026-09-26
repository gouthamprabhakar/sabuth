type ClientOption={id:string;name:string};

export function matchingClients<T extends ClientOption>(clients:T[],query:string){
 const needle=query.trim().toLocaleLowerCase();
 if(!needle)return clients;
 return clients.filter(client=>(client.name+' '+client.id).toLocaleLowerCase().includes(needle));
}

export function hasExactClientName(clients:ClientOption[],name:string){
 const value=name.trim();
 return value!==''&&clients.some(client=>client.name.trim().localeCompare(value,undefined,{sensitivity:'base'})===0);
}

export function clientById<T extends ClientOption>(clients:T[],id:string){return clients.find(client=>client.id===id)}
