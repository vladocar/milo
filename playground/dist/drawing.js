export function createScene(){return {x:250,y:250,angle:-90,color:'#237962',fill:null,width:3,pen:true,background:'#fdfefa',shapes:[],sprites:[]};}
export function applyCommand(scene,{name,args}){
  const style=()=>({color:scene.color,fill:scene.fill,width:scene.width});
  if(name==='sprite_state'){
    const [id,shape,color,x,y,visible]=args;
    const sprite={id,shape,color,x:250+x,y:250-y,visible};
    const index=scene.sprites.findIndex(s=>s.id===id);
    if(index<0)scene.sprites.push(sprite);else scene.sprites[index]=sprite;
  }else if(name==='move'){
    const x=scene.x+Math.cos(scene.angle*Math.PI/180)*args[0],y=scene.y+Math.sin(scene.angle*Math.PI/180)*args[0];
    if(scene.pen)scene.shapes.push({type:'line',x1:scene.x,y1:scene.y,x2:x,y2:y,...style()});scene.x=x;scene.y=y;
  }else if(name==='go_to'){scene.x=250+args[0];scene.y=250-args[1];}
  else if(name==='turn')scene.angle=(scene.angle+args[0])%360;
  else if(name==='color')scene.color=args[0];
  else if(name==='fill')scene.fill=args[0];
  else if(name==='no_fill')scene.fill=null;
  else if(name==='width')scene.width=args[0];
  else if(name==='pen_up')scene.pen=false;
  else if(name==='pen_down')scene.pen=true;
  else if(name==='home'){scene.x=250;scene.y=250;scene.angle=-90;}
  else if(name==='clear'){scene.shapes=[];scene.x=250;scene.y=250;scene.angle=-90;}
  else if(name==='circle')scene.shapes.push({type:'circle',x:scene.x,y:scene.y,radius:args[0],...style()});
  else if(name==='dot')scene.shapes.push({type:'dot',x:scene.x,y:scene.y,radius:args[0]/2,...style()});
  else if(name==='rectangle')scene.shapes.push({type:'rectangle',x:scene.x,y:scene.y,w:args[0],h:args[1],...style()});
  else if(name==='polygon'){
    const points=Array.from({length:args[0]},(_,i)=>{const a=(scene.angle+i*360/args[0])*Math.PI/180;return {x:scene.x+Math.cos(a)*args[1],y:scene.y+Math.sin(a)*args[1]};});
    scene.shapes.push({type:'polygon',points,...style()});
  }else if(name==='background')scene.background=args[0];
  else if(name==='write')scene.shapes.push({type:'text',x:scene.x,y:scene.y,text:args[0],...style()});
  return scene;
}
export function renderScene(target,scene,{grid=false,scale=2}={}){
  target.setTransform(scale,0,0,scale,0,0);target.clearRect(0,0,500,500);target.fillStyle=scene.background;target.fillRect(0,0,500,500);
  if(grid){target.fillStyle='#d9e2d1';for(let x=0;x<=500;x+=25)for(let y=0;y<=500;y+=25){target.beginPath();target.arc(x,y,.8,0,Math.PI*2);target.fill();}}
  for(const s of scene.shapes){
    target.strokeStyle=s.color;target.fillStyle=s.fill||s.color;target.lineWidth=s.width;target.lineCap='round';target.lineJoin='round';
    if(s.type==='line'){target.beginPath();target.moveTo(s.x1,s.y1);target.lineTo(s.x2,s.y2);target.stroke();}
    else if(s.type==='circle'||s.type==='dot'){
      target.beginPath();target.arc(s.x,s.y,s.radius,0,Math.PI*2);
      if(s.type==='dot'){target.fillStyle=s.color;target.fill();}
      else{if(s.fill)target.fill();target.stroke();}
    }else if(s.type==='rectangle'){target.beginPath();target.rect(s.x-s.w/2,s.y-s.h/2,s.w,s.h);if(s.fill)target.fill();target.stroke();}
    else if(s.type==='polygon'){target.beginPath();target.moveTo(s.points[0].x,s.points[0].y);for(const point of s.points.slice(1))target.lineTo(point.x,point.y);target.closePath();if(s.fill)target.fill();target.stroke();}
    else{target.fillStyle=s.color;target.font='20px Manrope, sans-serif';target.fillText(s.text,s.x,s.y);}
  }
  for(const sprite of scene.sprites)if(sprite.visible)renderSprite(target,sprite);
}
export function renderSprite(target,sprite){
  target.save();target.translate(sprite.x,sprite.y);
  target.fillStyle=sprite.color;target.strokeStyle='#355344';target.lineWidth=1.5;
  if(sprite.shape==='turtle'){
    for(const [x,y] of [[-12,-9],[12,-9],[-12,9],[12,9],[0,-16]]){
      target.beginPath();target.arc(x,y,4,0,Math.PI*2);target.fill();target.stroke();
    }
    target.beginPath();target.ellipse(0,0,12,14,0,0,Math.PI*2);target.fill();target.stroke();
    target.strokeStyle='#ffffffaa';target.beginPath();target.ellipse(0,0,7,9,0,0,Math.PI*2);target.stroke();
    target.fillStyle='#243d32';for(const x of [-1.5,1.5]){target.beginPath();target.arc(x,-17,1,0,Math.PI*2);target.fill();}
  }else{
    target.beginPath();
    if(sprite.shape==='circle')target.arc(0,0,20,0,Math.PI*2);
    else if(sprite.shape==='square')target.rect(-14,-14,28,28);
    else {
      for(let i=0;i<10;i++){const a=(-90+i*36)*Math.PI/180,r=i%2?9:20,x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)target.moveTo(x,y);else target.lineTo(x,y);}
      target.closePath();
    }
    target.fill();target.stroke();
  }
  target.restore();
}
