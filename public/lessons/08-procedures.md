# 8. Функции и подпрограммы

Когда программа растёт, повторяющиеся вычисления выносят в **процедуры**. В Фортране их два вида:

- **функция** (`function`) возвращает одно значение и вызывается внутри выражения: `rho = density(s, t)`;
- **подпрограмма** (`subroutine`) вызывается оператором `call` и может вернуть несколько результатов через аргументы: `call uv_to_speed_dir(u, v, spd, dir)`.

## Внутренние процедуры: `contains`

Проще всего разместить процедуры **внутри программы** после слова `contains`. Тогда компилятор знает их интерфейс и проверяет типы и количество аргументов при каждом вызове.

```fortran
program procedures_demo
  implicit none
  real :: tc
  tc = 15.0
  print *, tc, '°C =', to_kelvin(tc), 'K'
  call print_line(30)
  print *, 'f на 45° =', coriolis(45.0)

contains

  ! функция: тип результата указан перед словом function
  real function to_kelvin(t)
    real, intent(in) :: t
    to_kelvin = t + 273.15        ! результат — присваивание имени функции
  end function to_kelvin

  ! функция с явной переменной-результатом (так удобнее и нагляднее)
  function coriolis(lat_deg) result(f)
    real, intent(in) :: lat_deg
    real :: f
    real, parameter :: omega = 7.2921e-5, pi = 3.14159265
    f = 2.0 * omega * sin(lat_deg * pi / 180.0)
  end function coriolis

  ! подпрограмма: ничего не возвращает, только действует
  subroutine print_line(n)
    integer, intent(in) :: n
    integer :: i                  ! локальная переменная — видна только здесь
    write(*,'(*(A))') ('-', i = 1, n)
  end subroutine print_line

end program procedures_demo
```

## Атрибут `intent`

Указывайте, как процедура использует каждый аргумент:

| `intent` | Смысл |
|---|---|
| `in` | только читается (изменить нельзя — компилятор проверит) |
| `out` | только записывается: процедура выдаёт результат |
| `inout` | читается и изменяется |

Аргументы передаются **по ссылке**: изменение аргумента с `intent(out)` или `intent(inout)` меняет переменную в вызывающей программе.

```fortran
program subroutine_demo
  implicit none
  real :: u, v, spd, dir
  u = -3.0
  v = -4.0
  call uv_to_wind(u, v, spd, dir)
  print *, 'скорость', spd, 'м/с, дует с направления', dir, '°'

contains

  ! u, v — компоненты ветра (на восток и на север)
  ! dir — метеорологическое направление: ОТКУДА дует ветер, по часовой стрелке от севера
  subroutine uv_to_wind(u, v, speed, direction)
    real, intent(in) :: u, v
    real, intent(out) :: speed, direction
    real, parameter :: rad2deg = 180.0 / 3.14159265
    speed = sqrt(u**2 + v**2)
    direction = modulo(270.0 - atan2(v, u) * rad2deg, 360.0)
  end subroutine uv_to_wind

end program subroutine_demo
```

> **Течения и ветер — разные соглашения.** Направление ветра в метеорологии указывают *откуда* он дует, а направление течения в океанологии — *куда* оно направлено. Не путайте!

## Массивы как аргументы

Объявляйте аргумент-массив с **перенимаемой формой** `(:)`: процедура сама узнает размер через `size`.

```fortran
program array_args
  implicit none
  real :: t(6) = [8.1, 8.0, 7.2, 4.5, 2.1, 1.3]
  real :: m, s
  call mean_std(t, m, s)
  print *, 'среднее', m, ' СКО', s
  print *, 'нормированные аномалии:', standardize(t)

contains

  subroutine mean_std(x, mean, sd)
    real, intent(in) :: x(:)
    real, intent(out) :: mean, sd
    integer :: n
    n = size(x)
    mean = sum(x) / n
    sd = sqrt(sum((x - mean)**2) / (n - 1))
  end subroutine mean_std

  ! функция может возвращать массив
  function standardize(x) result(z)
    real, intent(in) :: x(:)
    real :: z(size(x))
    real :: m, s
    call mean_std(x, m, s)
    z = (x - m) / s
  end function standardize

end program array_args
```

## Ловушка: инициализация в объявлении = `save`

```f90
subroutine counter()
  integer :: calls = 0     ! ⚠ инициализация в объявлении делает переменную SAVE:
  calls = calls + 1        !   значение сохраняется между вызовами!
end subroutine
```

Если нужно обнулять переменную при каждом вызове, делайте это **оператором** (`calls = 0`) в теле процедуры, а не в объявлении.

## Рекурсия

Процедура, вызывающая сама себя, должна быть объявлена как `recursive` (начиная с Fortran 2018 это не обязательно, но так нагляднее):

```fortran
program recursion
  implicit none
  print *, 'НОД(1071, 462) =', gcd(1071, 462)
contains
  recursive function gcd(a, b) result(g)
    integer, intent(in) :: a, b
    integer :: g
    if (b == 0) then
      g = a
    else
      g = gcd(b, mod(a, b))
    end if
  end function gcd
end program recursion
```

~~~task
title: Расстояние между станциями
---
Напишите функцию `distance(lat1, lon1, lat2, lon2)`, которая возвращает расстояние в километрах по дуге большого круга (формула гаверсинусов):

$a = sin²(Δφ/2) + cos φ_1 · cos φ_2 · sin²(Δλ/2)$,   $d = 2R · arcsin(√a)$,   $R = 6371$ км.

Программа читает координаты двух точек (в градусах) и печатает расстояние.
@starter
program stations
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: lat1, lon1, lat2, lon2

  read(*,*) lat1, lon1, lat2, lon2
  print *, distance(lat1, lon1, lat2, lon2)

contains

  function distance(lat1, lon1, lat2, lon2) result(d)
    real(dp), intent(in) :: lat1, lon1, lat2, lon2
    real(dp) :: d

  end function distance

end program stations
@solution
program stations
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: lat1, lon1, lat2, lon2
  read(*,*) lat1, lon1, lat2, lon2
  print *, distance(lat1, lon1, lat2, lon2)
contains
  function distance(lat1, lon1, lat2, lon2) result(d)
    real(dp), intent(in) :: lat1, lon1, lat2, lon2
    real(dp) :: d, p1, p2, dp_, dl, a
    real(dp), parameter :: r = 6371.0_dp, deg = 4.0_dp * atan(1.0_dp) / 180.0_dp
    p1 = lat1 * deg
    p2 = lat2 * deg
    dp_ = (lat2 - lat1) * deg
    dl = (lon2 - lon1) * deg
    a = sin(dp_ / 2)**2 + cos(p1) * cos(p2) * sin(dl / 2)**2
    d = 2.0_dp * r * asin(sqrt(a))
  end function distance
end program stations
@hint
Все углы переведите в радианы: умножьте на $π/180$.
@test Москва — Санкт-Петербург
@stdin
55.7558 37.6173 59.9343 30.3351
@expect
633.0
@test один градус по меридиану
@stdin
0 0 1 0
@expect
111.19
@test
@stdin
-33.9 18.4 -34.6 -58.4
@expect
6870.6
@test одна точка
@stdin
60 30 60 30
@expect
0.0
~~~

~~~task
title: Ветер из компонент
---
Напишите подпрограмму `wind(u, v, speed, direction)`, которая по компонентам ветра $u$ (на восток) и $v$ (на север) вычисляет скорость и **метеорологическое** направление (откуда дует ветер, в градусах от 0 до 360, по часовой стрелке от севера).

Программа читает $u$ и $v$ (гарантируется, что они не равны нулю одновременно) и печатает скорость и направление.

*Подсказка к формуле:* $dir = (270° − atan2(v, u)) mod 360°$. Обратите внимание на функцию `modulo`: в отличие от `mod`, для отрицательных аргументов она возвращает неотрицательный остаток.
@starter
program wind_dir
  implicit none
  real :: u, v, spd, dir

  read(*,*) u, v
  call wind(u, v, spd, dir)
  print *, spd, dir

contains

  subroutine wind(u, v, speed, direction)
    real, intent(in) :: u, v
    real, intent(out) :: speed, direction

  end subroutine wind

end program wind_dir
@solution
program wind_dir
  implicit none
  real :: u, v, spd, dir
  read(*,*) u, v
  call wind(u, v, spd, dir)
  print *, spd, dir
contains
  subroutine wind(u, v, speed, direction)
    real, intent(in) :: u, v
    real, intent(out) :: speed, direction
    real, parameter :: rad2deg = 180.0 / 3.14159265
    speed = sqrt(u**2 + v**2)
    direction = modulo(270.0 - atan2(v, u) * rad2deg, 360.0)
  end subroutine wind
end program wind_dir
@test южный ветер (дует на север)
@stdin
0 5
@expect
5.0 180.0
@test западный
@stdin
5 0
@expect
5.0 270.0
@test
@stdin
-3 -4
@expect
5.0 36.87
@test
@stdin
2 2
@expect
2.828 225.0
~~~

~~~task
title: Номер дня в году
---
Многие ряды наблюдений индексируются **днём года** (1 — 1 января). Напишите:

- логическую функцию `is_leap(y)`;
- целую функцию `day_of_year(d, m, y)`.

Программа читает день, месяц и год и печатает номер дня в году.
@starter
program doy
  implicit none
  integer :: d, m, y

  read(*,*) d, m, y
  print *, day_of_year(d, m, y)

contains

  logical function is_leap(y)
    integer, intent(in) :: y

  end function is_leap

  integer function day_of_year(d, m, y)
    integer, intent(in) :: d, m, y

  end function day_of_year

end program doy
@solution
program doy
  implicit none
  integer :: d, m, y
  read(*,*) d, m, y
  print *, day_of_year(d, m, y)
contains
  logical function is_leap(y)
    integer, intent(in) :: y
    is_leap = (mod(y, 4) == 0 .and. mod(y, 100) /= 0) .or. mod(y, 400) == 0
  end function is_leap

  integer function day_of_year(d, m, y)
    integer, intent(in) :: d, m, y
    integer :: mdays(12) = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day_of_year = sum(mdays(1:m-1)) + d
    if (m > 2 .and. is_leap(y)) day_of_year = day_of_year + 1
  end function day_of_year
end program doy
@hint
Заведите массив длин месяцев `[31, 28, 31, …]`. Номер дня = сумма длин предыдущих месяцев + день, плюс 1, если год високосный и месяц позже февраля.
@test
@stdin
1 1 2025
@expect
1
@test
@stdin
31 12 2024
@expect
366
@test
@stdin
1 3 2024
@expect
61
@test
@stdin
1 3 2023
@expect
60
@test
@stdin
15 8 2025
@expect
227
~~~
