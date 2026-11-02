def square(n):
    return n * n

total = 0
for n in range(1, 500001):
    total = total + square(n)
print(total)
