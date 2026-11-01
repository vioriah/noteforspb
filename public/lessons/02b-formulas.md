# 2½. Математические формулы: от бумаги к коду

Главный навык этого этапа — **без ошибок перевести формулу из учебника в строку на Фортране**. В тетради дробь записывается «этажами», корень — значком, степень — маленькой цифрой сверху. В программе всё это выстраивается в одну строку, и порядок действий задают **скобки** и **приоритеты операций**.

## Приоритет операций

| Приоритет | Операция | Пример | Порядок вычисления |
|---|---|---|---|
| 1 (высший) | вызов функции | `sqrt(x)` | сначала аргумент, потом функция |
| 2 | `**` — степень | `2**3**2` | **справа налево**: `2**(3**2)` = 512 |
| 3 | `*`, `/` | `a / b * c` | слева направо: `(a / b) * c` |
| 4 | унарный `-`, `+` | `-x**2` | `-(x**2)`: минус применяется **после** степени |
| 5 | `+`, `-` | `a - b + c` | слева направо |

Проверьте себя — запустите и сравните с тем, что ожидали:

```fortran
program precedence
  implicit none
  real :: a, b, c, x
  a = 6.0;  b = 2.0;  c = 3.0;  x = 3.0     ! ; — несколько операторов в одной строке
  print *, 'a / b * c   =', a / b * c        ! (6/2)*3 = 9,  а НЕ 6/(2*3) = 1
  print *, 'a / (b * c) =', a / (b * c)
  print *, 'a / b / c   =', a / b / c        ! тоже 6/(2*3) = 1
  print *, '-x**2       =', -x**2            ! -9, а не 9
  print *, '(-x)**2     =', (-x)**2
  print *, '2**3**2     =', 2**3**2          ! 512, а не 64
  print *, '(2**3)**2   =', (2**3)**2
end program precedence
```

> **Правило:** если сомневаетесь — ставьте скобки. Лишние скобки не замедляют программу и не бывают ошибкой.

## Дроби

Дробь «числитель / знаменатель» записывается как `(числитель) / (знаменатель)`. **Обе скобки обязательны**, если в числителе или знаменателе больше одного слагаемого или множителя:

| На бумаге | Правильно | Ошибка |
|---|---|---|
| $(a + b) / (c + d)$ | `(a + b) / (c + d)` | `a + b / c + d` |
| $a / (2b)$ | `a / (2*b)` | `a / 2*b` (это $ab/2$!) |
| $1 / (1 + 1/x)$ | `1 / (1 + 1/x)` | `1 / 1 + 1/x` |

«Многоэтажные» дроби разбирайте изнутри наружу или вводите **промежуточные переменные**: так легче проверить каждую часть.

```fortran
program fraction_demo
  implicit none
  real(8) :: x, num, den, y
  x = 2.0d0
  ! y = (x^2 + 3x - 1) / (sqrt(x) + 1/x)
  num = x**2 + 3*x - 1
  den = sqrt(x) + 1/x
  y = num / den
  print *, 'по частям:   ', y
  print *, 'одной строкой:', (x**2 + 3*x - 1) / (sqrt(x) + 1/x)
end program fraction_demo
```

## Целые числа в формулах — главная ловушка

Если в делении **оба** операнда целые, дробная часть отбрасывается. В формулах это чаще всего случается с числовыми коэффициентами:

```fortran
program integer_trap
  implicit none
  real :: r, v_bad, v_good
  r = 2.0
  v_bad  = 4/3 * 3.14159 * r**3        ! 4/3 = 1 (целое деление!)
  v_good = 4.0/3.0 * 3.14159 * r**3
  print *, 'объём шара (ошибка): ', v_bad
  print *, 'объём шара (верно):  ', v_good
  print *, '1/2 * r =', 1/2 * r, '   0.5 * r =', 0.5 * r
  print *, 'r**(1/3) =', r**(1/3), '   r**(1.0/3.0) =', r**(1.0/3.0)
end program integer_trap
```

`r**(1/3)` — коварная ошибка: показатель `1/3` равен целому нулю, и получается $r⁰ = 1$ вместо кубического корня.

> **Правило:** коэффициенты в формулах пишите вещественными: `4.0/3.0`, `0.5`, `1.0/3.0`, `2.0*pi`.

## Степени и корни

| Математика | Фортран | Замечание |
|---|---|---|
| $x²$, $x³$ | `x**2`, `x**3` | целый показатель — быстро и точно, работает и для $x < 0$ |
| $√x$ | `sqrt(x)` | $x ≥ 0$, иначе NaN |
| $∛x$ | `x**(1.0/3.0)` | только для $x ≥ 0$! |
| $x^{-1}$ | `1.0/x` или `x**(-1)` | для целого `x` выражение `x**(-1)` даст 0 |
| $x^{2.5}$ | `x**2.5` | вещественный показатель — только для $x > 0$ |
| $ⁿ√x$ | `x**(1.0/n)` | |

Отрицательное число в **вещественной** степени не определено: `(-8.0)**(1.0/3.0)` даёт NaN, хотя математически $∛(−8) = −2$. Кубический корень любого знака вычисляется так: `sign(abs(x)**(1.0/3.0), x)`. Функция `sign(a, b)` возвращает модуль `a` со знаком `b`.

```fortran
program roots
  implicit none
  real(8) :: x
  x = -8.0d0
  print *, 'sqrt(2)           =', sqrt(2.0d0)
  print *, '2**0.5            =', 2.0d0**0.5d0
  print *, '(-8)**(1/3.)      =', x**(1.0d0/3.0d0)              ! NaN
  print *, 'кубический корень =', sign(abs(x)**(1.0d0/3.0d0), x)  ! -2
  print *, 'корень 5-й степени из 32 =', 32.0d0**(1.0d0/5.0d0)
end program roots
```

## Экспонента, логарифмы, тригонометрия

| Математика | Фортран |
|---|---|
| $e^x$ | `exp(x)` |
| $ln x$ | `log(x)` — натуральный! |
| $lg x$ | `log10(x)` |
| $log_a x$ | `log(x) / log(a)` |
| модуль $x$ | `abs(x)` |
| $sin²x$ | `sin(x)**2` (не `sin**2(x)`) |
| $sin x°$ | `sin(x * pi / 180)` |
| $arctg(y/x)$ с учётом четверти | `atan2(y, x)` |
| $π$ | `pi = 4.0*atan(1.0)` или константа |
| $e$ | `exp(1.0)` |

## Длинные формулы

Строку можно перенести символом `&`. Хороший стиль — разбить формулу на смысловые части:

```fortran
program long_formula
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: x, mu, sigma, gauss
  x = 1.5_dp;  mu = 1.0_dp;  sigma = 0.5_dp
  ! плотность нормального распределения
  gauss = 1.0_dp / (sigma * sqrt(2.0_dp * pi)) &
          * exp(-(x - mu)**2 / (2.0_dp * sigma**2))
  print *, 'f(x) =', gauss
end program long_formula
```

## Все типы данных в одной программе

```fortran
program all_types
  implicit none
  integer :: n
  real :: x
  real(8) :: y
  complex :: z
  logical :: flag
  character(len=10) :: word

  n = 7
  x = 1.0 / 3.0
  y = 1.0d0 / 3.0d0
  z = (1.0, 2.0)                  ! 1 + 2i
  flag = x > 0.3
  word = 'океан'

  print *, 'integer:  ', n, '  максимум:', huge(n)
  print *, 'real:     ', x, '  ~цифр:', precision(x)
  print *, 'real(8):  ', y, '  ~цифр:', precision(y)
  print *, 'complex:  ', z, '  z*z =', z*z, '  |z| =', abs(z)
  print *, 'logical:  ', flag, .not. flag
  print *, 'character:', trim(word), ' / длина', len(word)
  print *, 'n + x  (integer + real -> real):', n + x
  print *, 'int(3.99), nint(3.99):', int(3.99), nint(3.99)
  print *, 'переполнение integer: huge(n) + 1 =', huge(n) + n - 6
end program all_types
```

Последняя строка показывает **переполнение**: целое число, вышедшее за предел ≈ 2.1·10⁹, «перескакивает» в отрицательные значения без всякого предупреждения.

---

## Задачи

В каждой задаче прочитайте данные через `read(*,*)` и напечатайте ответ через `print *`. Подписи к числам печатать можно: проверяются только числа и их порядок.

~~~task
title: Дробь
---
Прочитайте $x ≠ 0$ и вычислите

$y = (x² − 3x + 1) / (2x + 5) + 1/x$.
@starter
program fraction
  implicit none
  real(8) :: x, y

  read(*,*) x

end program fraction
@solution
program fraction
  implicit none
  real(8) :: x, y
  read(*,*) x
  y = (x**2 - 3*x + 1) / (2*x + 5) + 1/x
  print *, y
end program fraction
@hint
Числитель и знаменатель — каждый в своих скобках: `(…) / (…)`.
@test
@stdin
2
@expect
0.388889
@test
@stdin
-1
@expect
0.666667
@test
@stdin
10
@expect
2.94
~~~

~~~task
title: Многоэтажная дробь
---
Прочитайте $x > 0$ и вычислите цепную дробь

$y = 1 + 1 / (1 + 1 / (1 + 1/x))$.
@starter
program chain
  implicit none
  real(8) :: x

  read(*,*) x

end program chain
@solution
program chain
  implicit none
  real(8) :: x
  read(*,*) x
  print *, 1 + 1 / (1 + 1 / (1 + 1/x))
end program chain
@hint
Разберите изнутри: сначала $a = 1 + 1/x$, потом $b = 1 + 1/a$, потом $y = 1 + 1/b$.
@test
@stdin
1
@expect
1.666667
@test
@stdin
2
@expect
1.6
@test
@stdin
0.5
@expect
1.75
~~~

~~~task
title: Квадратный и кубический корни
---
Прочитайте $a$ и $b$ и вычислите

$z = √(a² + b²) + ∛(a·b)$.

Внимание: произведение $ab$ может быть **отрицательным**, а кубический корень из отрицательного числа существует ($∛(−8) = −2$).
@starter
program roots_task
  implicit none
  real(8) :: a, b

  read(*,*) a, b

end program roots_task
@solution
program roots_task
  implicit none
  real(8) :: a, b, p
  read(*,*) a, b
  p = a * b
  print *, sqrt(a**2 + b**2) + sign(abs(p)**(1.0d0/3.0d0), p)
end program roots_task
@hint
`p**(1.0/3.0)` для отрицательного `p` даёт NaN. Используйте `sign(abs(p)**(1.0/3.0), p)`.
@hint
И не пишите `1/3`: это целый ноль!
@test
@stdin
3 4
@expect
7.289428
@test отрицательное произведение
@stdin
-2 4
@expect
2.472136
@test
@stdin
0 5
@expect
5.0
~~~

~~~task
title: Найдите ошибку: объём шара
---
Программа должна вычислять объём шара $V = (4/3)·πr³$, но печатает неверный ответ (компилируется она без ошибок!). Найдите и исправьте ошибку.
@starter
program sphere
  implicit none
  real :: r, v
  read(*,*) r
  v = 4/3 * 3.14159265 * r**3
  print *, v
end program sphere
@solution
program sphere
  implicit none
  real :: r, v
  read(*,*) r
  v = 4.0/3.0 * 3.14159265 * r**3
  print *, v
end program sphere
@hint
Чему равно `4/3` в Фортране?
@test
@stdin
1
@expect
4.18879
@test
@stdin
2
@expect
33.5103
@test
@stdin
0.5
@expect
0.523599
~~~

~~~task
title: Формула Герона
---
Прочитайте длины сторон треугольника $a, b, c$ и найдите его площадь:

$p = (a + b + c)/2$,   $S = √(p(p − a)(p − b)(p − c))$.
@starter
program heron
  implicit none
  real(8) :: a, b, c

  read(*,*) a, b, c

end program heron
@solution
program heron
  implicit none
  real(8) :: a, b, c, p
  read(*,*) a, b, c
  p = (a + b + c) / 2
  print *, sqrt(p * (p - a) * (p - b) * (p - c))
end program heron
@test
@stdin
3 4 5
@expect
6.0
@test
@stdin
5 5 6
@expect
12.0
@test
@stdin
2 3 4
@expect
2.904738
~~~

~~~task
title: Логический тип: существует ли треугольник?
---
Треугольник со сторонами $a, b, c$ существует, если каждая сторона **строго меньше** суммы двух других. Прочитайте $a, b, c$, сохраните результат проверки в переменную типа `logical` и напечатайте её через `print *` (Фортран выведет `T` или `F`).
@starter
program triangle
  implicit none
  real :: a, b, c
  logical :: exists

  read(*,*) a, b, c

end program triangle
@solution
program triangle
  implicit none
  real :: a, b, c
  logical :: exists
  read(*,*) a, b, c
  exists = (a < b + c) .and. (b < a + c) .and. (c < a + b)
  print *, exists
end program triangle
@hint
Логические операции: `.and.`, `.or.`, `.not.`. Результат сравнения `a < b + c` уже имеет тип `logical`.
@test
@stdin
3 4 5
@expect
T
@test вырожденный
@stdin
1 2 3
@expect
F
@test
@stdin
1 1 1.5
@expect
T
@test
@stdin
10 1 1
@expect
F
~~~

~~~task
title: Три средних
---
Для трёх положительных чисел $a, b, c$ выведите:

- среднее арифметическое $(a + b + c)/3$;
- среднее геометрическое $∛(abc)$;
- среднее гармоническое $3 / (1/a + 1/b + 1/c)$.
@starter
program means
  implicit none
  real(8) :: a, b, c

  read(*,*) a, b, c

end program means
@solution
program means
  implicit none
  real(8) :: a, b, c
  read(*,*) a, b, c
  print *, (a + b + c) / 3, (a * b * c)**(1.0d0/3.0d0), 3 / (1/a + 1/b + 1/c)
end program means
@test
@stdin
1 2 4
@expect
2.333333 2.0 1.714286
@test
@stdin
5 5 5
@expect
5.0 5.0 5.0
@test
@stdin
1 10 100
@expect
37.0 10.0 2.702703
~~~

~~~task
title: Большая формула
---
Прочитайте $x$ и вычислите

$y = e^{−x²/2} / √(2π) + ln(1 + |x|) − sin²x · cos x$.

(Здесь $ln$ — натуральный логарифм, $x$ — в радианах.)
@starter
program big_formula
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: x

  read(*,*) x

end program big_formula
@solution
program big_formula
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: x
  read(*,*) x
  print *, exp(-x**2 / 2) / sqrt(2 * pi) + log(1 + abs(x)) - sin(x)**2 * cos(x)
end program big_formula
@hint
$sin²x$ записывается как `sin(x)**2`. Натуральный логарифм — `log`, не `log10`.
@test
@stdin
0
@expect
0.398942
@test
@stdin
1
@expect
0.552544
@test
@stdin
-2
@expect
1.496683
~~~

~~~task
title: Волна на мелководье
---
На мелкой воде скорость волны $c = √(gh)$, а энергия волны на единицу площади $E = ρgH²/8$, где $h$ — глубина (м), $H$ — высота волны (м), $g = 9.81$ м/с², $ρ = 1025$ кг/м³.

Прочитайте $h$ и $H$ и выведите $c$ (м/с) и $E$ (Дж/м²). Константы $g$ и $ρ$ объявите через `parameter`.
@starter
program shallow
  implicit none
  real(8) :: h, hw

  read(*,*) h, hw

end program shallow
@solution
program shallow
  implicit none
  real(8), parameter :: g = 9.81d0, rho = 1025.0d0
  real(8) :: h, hw
  read(*,*) h, hw
  print *, sqrt(g * h), rho * g * hw**2 / 8
end program shallow
@hint
Регистр в Фортране не важен: `h` и `H` — **одна и та же** переменная! Поэтому высоту волны назовите иначе, например `hw`.
@test
@stdin
4 1.5
@expect
6.264 2828.0
@test
@stdin
10 0.5
@expect
9.905 314.2
@test
@stdin
1 0.2
@expect
3.132 50.28
~~~

~~~task
title: Точность real и real(8)
---
Прочитайте маленькое число $x$. Вычислите выражение $(1 + x) − 1$ **дважды**: в одинарной точности (`real`) и в двойной (`real(8)`). Выведите оба результата.

Математически ответ равен $x$. Посмотрите, что получается на самом деле.
@starter
program precision_task
  implicit none
  real :: xs
  real(8) :: xd

  read(*,*) xd
  xs = real(xd)

end program precision_task
@solution
program precision_task
  implicit none
  real :: xs
  real(8) :: xd
  read(*,*) xd
  xs = real(xd)
  print *, (1.0 + xs) - 1.0, (1.0d0 + xd) - 1.0d0
end program precision_task
@hint
В одинарной точности числа хранятся примерно с 7 значащими цифрами, поэтому $1 + 10^{-10}$ просто равно 1.
@test
@stdin
1e-10
@expect
0.0 1.0E-10
@test
@stdin
0.25
@expect
0.25 0.25
~~~
