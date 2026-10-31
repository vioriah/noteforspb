# 5. Циклы

## Цикл со счётчиком: `do`

```f90
do i = начало, конец [, шаг]
  ...
end do
```

Счётчик — **целая** переменная. Шаг может быть отрицательным. Если `начало > конец` при положительном шаге, тело не выполнится ни разу. Менять счётчик внутри цикла **нельзя**.

```fortran
program hydrostatic_table
  implicit none
  integer :: z
  real :: p
  ! гидростатическое давление p = rho*g*z (переводим Па в децибары: 1 дбар = 10^4 Па)
  print '(A)', '  z, м    p, дбар'
  do z = 0, 100, 20
    p = 1025.0 * 9.81 * z / 1.0e4
    print '(I5, F10.2)', z, p
  end do
end program hydrostatic_table
```

Обратите внимание: давление в децибарах численно почти равно глубине в метрах. Поэтому в океанологии давление часто измеряют в дбар.

Нужен вещественный шаг? Заведите целый счётчик и вычисляйте из него вещественную величину: `x = x0 + i*dx`. Цикл вида `do x = 0.0, 1.0, 0.1` устарел: из-за ошибок округления неизвестно, сколько раз он выполнится.

## Накопление суммы

Типичная схема: **обнулить** накопитель перед циклом и прибавлять к нему в теле.

```fortran
program sum_series
  implicit none
  integer :: k, n
  real(8) :: s
  n = 1000000
  s = 0.0d0
  do k = 1, n
    s = s + 1.0d0 / real(k, 8)**2
  end do
  print *, 'Сумма 1/k^2 =', s
  print *, 'pi^2/6      =', (4.0d0 * atan(1.0d0))**2 / 6.0d0
end program sum_series
```

## Цикл с условием: `do while`

Повторяется, **пока** условие истинно. Позаботьтесь, чтобы условие когда-нибудь стало ложным, иначе получится бесконечный цикл (программа будет остановлена через несколько секунд).

```fortran
program exp_series
  implicit none
  ! exp(x) = 1 + x + x^2/2! + x^3/3! + ... ; суммируем, пока член ряда не станет малым
  real(8) :: x, term, s
  integer :: k
  x = 2.0d0
  term = 1.0d0
  s = term
  k = 0
  do while (abs(term) > 1.0d-12)
    k = k + 1
    term = term * x / k        ! каждый член получаем из предыдущего
    s = s + term
  end do
  print *, 'членов:', k, '  сумма =', s, '  exp(x) =', exp(x)
end program exp_series
```

> Член ряда $x^k/k!$ выгодно вычислять **из предыдущего**: $a_k = a_{k-1}·x/k$. Если считать степень и факториал отдельно, факториал быстро переполнит `integer` (13! уже больше 2³¹).

## `exit` и `cycle`

- `exit` — немедленно выйти из цикла;
- `cycle` — перейти к следующей итерации.

«Бесконечный» `do` без заголовка + `exit` — стандартный способ читать данные до признака конца:

```fortran
program until_sentinel
  implicit none
  real :: t, s
  integer :: n
  n = 0
  s = 0.0
  do
    read(*,*) t
    if (t == -999.0) exit        ! -999 — признак конца данных
    if (t < -2.0) cycle          ! пропускаем заведомо ошибочные значения
    n = n + 1
    s = s + t
  end do
  print *, 'Принято измерений:', n, '  средняя T =', s / n
end program until_sentinel
```
```stdin
3.1
2.9
-50
3.4
-999
```

## Вложенные циклы

```fortran
program multiplication
  implicit none
  integer :: i, j
  do i = 1, 5
    write(*,'(5I4)') (i * j, j = 1, 5)   ! "неявный цикл" внутри write
  end do
end program multiplication
```

Конструкция `(выражение, j = 1, 5)` — **неявный цикл** (*implied do*). Она очень удобна для ввода и вывода.

~~~task
title: Суммы
---
Прочитайте натуральное $n$. Выведите два числа: сумму $1 + 2 + … + n$ и сумму квадратов $1² + 2² + … + n²$. Используйте цикл (а не готовую формулу).
@starter
program sums
  implicit none
  integer :: n, i

  read(*,*) n

end program sums
@solution
program sums
  implicit none
  integer :: n, i, s1, s2
  read(*,*) n
  s1 = 0
  s2 = 0
  do i = 1, n
    s1 = s1 + i
    s2 = s2 + i * i
  end do
  print *, s1, s2
end program sums
@test
@stdin
3
@expect
6 14
@test
@stdin
1
@expect
1 1
@test
@stdin
100
@expect
5050 338350
~~~

~~~task
title: Синус рядом Тейлора
---
Вычислите $sin x$ с помощью ряда $sin x = x − x³/3! + x⁵/5! − …$. Суммируйте, пока модуль очередного члена больше $10^-10$. Встроенную функцию `sin` использовать нельзя.

Прочитайте $x$ (радианы) и выведите сумму.
@starter
program taylor_sin
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: x, term, s
  integer :: k

  read(*,*) x

end program taylor_sin
@solution
program taylor_sin
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: x, term, s
  integer :: k
  read(*,*) x
  term = x
  s = x
  k = 1
  do while (abs(term) > 1.0e-10_dp)
    term = -term * x * x / ((k + 1) * (k + 2))
    k = k + 2
    s = s + term
  end do
  print *, s
end program taylor_sin
@hint
Следующий член получается из предыдущего умножением на $−x²/((k+1)(k+2))$, где $k$ — степень предыдущего члена.
@test
@stdin
1
@expect
0.841471
@test
@stdin
3
@expect
0.141120
@test
@stdin
-2
@expect
-0.909297
@test
@stdin
0.5
@expect
0.479426
~~~

~~~task
title: Ряд до признака конца
---
Вводятся температуры воды (по одной в строке). Последовательность заканчивается числом `-999`, которое в данные не входит. Выведите три числа: количество измерений, среднюю температуру и максимальную температуру.
@starter
program sentinel
  implicit none
  real :: t
  integer :: n

  do
    read(*,*) t
    if (t == -999.0) exit

  end do

end program sentinel
@solution
program sentinel
  implicit none
  real :: t, s, tmax
  integer :: n
  n = 0
  s = 0.0
  tmax = -huge(1.0)
  do
    read(*,*) t
    if (t == -999.0) exit
    n = n + 1
    s = s + t
    tmax = max(tmax, t)
  end do
  print *, n, s / n, tmax
end program sentinel
@hint
Начальное значение максимума — очень маленькое число, например `-huge(1.0)`, или первое прочитанное значение.
@test
@stdin
3.1
2.9
3.4
-999
@expect
3 3.133 3.4
@test
@stdin
-1.2
-1.5
-0.8
-1.9
-999
@expect
4 -1.35 -0.8
@test
@stdin
15.0
-999
@expect
1 15.0 15.0
~~~

~~~task
title: Таблица давления
---
Прочитайте максимальную глубину $H$ и шаг $Δz$ (целые, м). Выведите таблицу: в каждой строке глубина $z = 0, Δz, 2Δz, …, H$ и гидростатическое давление в децибарах $p = ρgz / 10^4$, где $ρ = 1025$ кг/м³, $g = 9.81$ м/с².
@starter
program ptable
  implicit none
  integer :: h, dz, z

  read(*,*) h, dz

end program ptable
@solution
program ptable
  implicit none
  integer :: h, dz, z
  read(*,*) h, dz
  do z = 0, h, dz
    print '(I6, F10.2)', z, 1025.0 * 9.81 * z / 1.0e4
  end do
end program ptable
@test
@stdin
30 10
@expect
0 0.00
10 10.06
20 20.11
30 30.17
@test
@stdin
1000 250
@expect
0 0.00
250 251.38
500 502.76
750 754.14
1000 1005.53
~~~
