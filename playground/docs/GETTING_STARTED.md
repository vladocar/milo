# Getting started with Milo

Open the deployed demo, or follow the local server instructions in the [README](../README.md).

## Try a starter

1. Open **My projects → Starter projects**.
2. Pick a project and choose **Make a copy**.
3. Select **Run code**.
4. Change one value and run again.

Each copy is a separate saved project. Copying the same starter again adds a number to its name.

## Draw a flower

```milo
background("lavender")
color("purple")
width(3)

repeat 12
    circle(50)
    move(20)
    turn(30)
end
```

Try changing `12`, `50`, or the colors. `circle` draws around the turtle without moving it; `move` draws forward.

## Ask a question

```milo
name = ask("What is your name? ")
say "Hello", name
```

Type your answer in **Messages**, then select **Send answer**. Use **Swap panels** if you prefer Messages above the canvas.

## Make a choice

```milo
answer = number(ask("What is 3 + 4? "))
if answer == 7
    say "You got it!"
else
    say "Try again!"
end
```

`=` stores a value. `==` compares values. `number` turns numeric text into a number.

## Animate a dot

Choose **Quick** drawing pace:

```milo
color("coral")
repeat 8 as frame
    clear()
    go_to(frame * 40 - 180, 0)
    dot(40)
    wait(0.15)
end
```

Each frame clears the old picture, draws the next one, and pauses.

## Meet a sprite

```milo
player = sprite("turtle", "teal")
star = sprite("star", "gold")
place(player, -80, 0)
place(star, 80, 0)

repeat 4
    direction = key()
    if direction == "right"
        shift(player, 40, 0)
    end
    if touching(player, star)
        hide(star)
        say "You found the star!"
        break
    end
end
```

Press Right or use the on-screen Right button. Each new key press uses one turn. Sprites move independently of the drawing turtle.

## Play a tune

```milo
for note in [60, 64, 67, 72]
    play_note(note, 0.25)
end
```

Turn **Sound on** if muted. A note number of 60 is middle C.

## Keep your work

Use **Save project** to name it. Use the program download button for a `.milo` backup. **Open a program** imports downloaded source; save it as a project afterward.

**Save picture** exports the drawing and sprites. It does not include the editor, messages, or score panel.

For more commands, open **Help & commands** in the playground or read the [reference](REFERENCE.md).
