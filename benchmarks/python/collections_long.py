items = [10, 20, 30, 40, 50]
total = 0
for _ in range(300000):
    for item in items:
        total = total + item
print(total)
