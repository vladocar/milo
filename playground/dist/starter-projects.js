import {extraStarters} from './extra-starters.js';
import {examples} from './lessons.js';
import {starterPreviews} from './starter-previews.js';
const fromExample=(id,name,category,description)=>({id,name,category,description,code:examples.find(example=>example.name===name).code});
export const starterProjects = [
  ...extraStarters,
  {id:'robot',name:'Robot friend',category:'Drawing',description:'Build a friendly robot from shapes. Change its colors or give it bigger eyes.',code:`background("#f4f7ec")
color("navy")
width(3)
fill("turquoise")
rectangle(140, 130)
go_to(0, 115)
rectangle(120, 85)
color("white")
go_to(-28, 125)
dot(30)
go_to(28, 125)
dot(30)
color("navy")
go_to(-28, 125)
dot(12)
go_to(28, 125)
dot(12)
go_to(0, 95)
fill("coral")
rectangle(50, 10)
color("navy")
go_to(-100, 0)
fill("gold")
rectangle(40, 90)
go_to(100, 0)
rectangle(40, 90)
go_to(-38, -100)
rectangle(35, 70)
go_to(38, -100)
rectangle(35, 70)
go_to(0, 25)
color("coral")
dot(25)
say "Hello from your robot friend!"
`},
  fromExample('five-stars','Collect five stars','Game','Steer a turtle, collect random stars, and reach five points. Use arrows or the direction buttons.'),
  fromExample('village','A little shape village','Drawing','Make a sunny little village with filled shapes. Add another house or a second tree.'),
  {id:'night-sky',name:'A sky full of stars',category:'Drawing',description:'Scatter gold stars across a night sky. Run again for a new constellation.',code:`background("navy")
color("gold")
repeat 20
    star = sprite("star", "gold")
    place(star, random(-5, 5) * 40, random(-5, 5) * 40)
end
color("white")
fill("white")
go_to(145, 150)
circle(40)
color("navy")
fill("navy")
go_to(165, 160)
circle(37)
say "A different sky every time."
`},
  fromExample('rainbow','Rainbow spiral','Drawing','Grow a colorful spiral one turn at a time. Try changing the turn from 91 to 89.'),
  {id:'flower-wheel',name:'Flower wheel',category:'Drawing',description:'Turn repeated circles into a flower. Try a different petal color or more turns.',code:`background("#fcf8ee")
color("pink")
width(3)
repeat 12
    move(65)
    circle(35)
    pen_up()
    move(-65)
    pen_down()
    turn(30)
end
go_to(0, 0)
color("gold")
dot(55)
say "Twelve petals, one little loop."
`},
  {id:'bouncing-ball',name:'Bouncing ball',category:'Animation',description:'Animate a ball across the canvas. Choose Quick pace, then change the size or speed.',code:`background("#eff7f4")
color("coral")
x = -180
direction = 1
repeat 40
    clear()
    go_to(x, 0)
    dot(50)
    wait(0.05)
    x = x + direction * 20
    if x >= 180
        direction = -1
    else if x <= -180
        direction = 1
    end
end
say "Try a different wait time!"
`},
  fromExample('melody','A little melody','Music','Play four notes in a row. Change a note number to make the melody your own.'),
  {id:'random-melody',name:'Surprise melody',category:'Music',description:'Let chance choose eight notes. Each run makes a new little tune.',code:`say "Your surprise melody:"
repeat 8
    note = random(60, 72)
    say note
    play_note(note, 0.2)
end
say "Run again for a new tune!"
`},
  {id:'tiny-quiz',name:'Animal quiz',category:'Game',description:'Ask a question and check the answer. Replace it with a question about your favorite animal.',code:`answer = lower(ask("Which animal says meow? "))
if answer == "cat"
    say "That is right!"
    show_score(1)
    play_note(72, 0.2)
else
    say "A cat says meow. Try again!"
    show_score(0)
end
`},
  fromExample('stars','A field of stars','Drawing','Draw two stars using your own function. Add more stars with new sizes and colors.'),
  fromExample('greeter','Friendly greeter','Story','Make a program that asks your name and says hello. Give it another question to ask.')
].map(project=>({...project,thumbnail:starterPreviews[project.id]||null}));
export function createStarterCopy(store,starter){
  const names=new Set(store.list().map(project=>project.name));
  let name=starter.name,index=2;
  while(names.has(name)){const suffix=` (${index++})`;name=starter.name.slice(0,60-suffix.length)+suffix;}
  return store.save({name,code:starter.code,thumbnail:starter.thumbnail});
}
