# 2. Типы данных, константы и выражения

## Встроенные типы

| Тип | Что хранит | Пример объявления | Литералы |
|---|---|---|---|
| `integer` | целые числа (обычно 4 байта, до ±2 147 483 647) | `integer :: n, year` | `42`, `-7` |
| `real` | вещественные одинарной точности (~7 значащих цифр) | `real :: t, s` | `3.5`, `1.0e-3` |
| `real(8)` / `double precision` | двойной точности (~15–16 цифр) | `real(8) :: rho` | `1.0d0`, `9.81d0` |
| `logical` | истина/ложь | `logical :: ok` | `.true.`, `.false.` |
| `character` | строка фиксированной длины | `character(len=20) :: name` | `'Барьерный риф'` |
| `complex` | комплексные числа | `complex :: z` | `(1.0, -2.0)` |

Объявления пишутся в начале программы, после `implicit none`. Можно сразу задать начальное значение: `real :: g = 9.81`.

## Точность: kind

Для океанологических расчётов одинарной точности часто **не хватает**. Например, плотность морской воды ≈ 1027.xxx кг/м³, а нас интересуют сотые и тысячные доли. Поэтому договоримся использовать двойную точность. Современный и переносимый способ задать её — параметр `kind`:

```fortran
program precision_demo
  implicit none
  integer, parameter :: dp = kind(1.0d0)   ! "вид" чисел двойной точности
  real :: a
  real(dp) :: b

  a = 1.0 / 3.0
  b = 1.0_dp / 3.0_dp                      ! суффикс _dp у литералов!
  print *, 'real    :', a
  print *, 'real(dp):', b
  print *, 'Сколько цифр гарантировано:', precision(a), precision(b)
  print *, '0.1 + 0.2 =', 0.1 + 0.2, 0.1_dp + 0.2_dp
end program precision_demo
```

> **Ловушка.** `real(dp) :: x = 0.1` — литерал `0.1` записан в *одинарной* точности и только потом преобразуется. Чтобы получить точное `0.1` двойной точности, пишите `0.1_dp` или `0.1d0`.

## Именованные константы: `parameter`

Значение константы нельзя изменить во время работы программы — компилятор за этим следит:

```f90
real(dp), parameter :: pi = 3.141592653589793_dp
real(dp), parameter :: g = 9.81_dp           ! ускорение свободного падения, м/с²
real(dp), parameter :: omega = 7.2921e-5_dp  ! угловая скорость вращения Земли, рад/с
```

Удобный приём: `pi = 4*atan(1.0_dp)` — π с полной точностью.

## Арифметика

Операции: `+  -  *  /  **` (возведение в степень). Приоритет обычный: сначала `**`, затем `*` и `/`, затем `+` и `-`. Цепочка степеней вычисляется справа налево: `2**3**2 = 2**9`.

### ⚠ Целочисленное деление

Если **оба** операнда целые, результат тоже целый, а дробная часть **отбрасывается**:

```fortran
program int_division
  implicit none
  integer :: n
  n = 7
  print *, '7/2       =', 7/2
  print *, '7.0/2     =', 7.0/2
  print *, '-7/2      =', -7/2          ! отбрасывание к нулю
  print *, 'mod(7,2)  =', mod(7, 2)     ! остаток от деления
  print *, '1/n*14    =', 1/n*14        ! 1/7 = 0, потом 0*14 = 0 (!)
  print *, '14.0/n    =', 14.0/n
  print *, 'real(n)/2 =', real(n)/2     ! явное преобразование
end program int_division
```

Классическая ошибка — `mean = sum / n`, где `sum` и `n` целые. Пишите `real(sum) / n`.

### Преобразование типов

| Функция | Действие | Пример |
|---|---|---|
| `real(x)`, `real(x, dp)` | в вещественное | `real(7)` → 7.0 |
| `int(x)` | в целое, отбрасывая дробную часть | `int(-2.7)` → −2 |
| `nint(x)` | ближайшее целое (округление) | `nint(2.5)` → 3 |
| `floor(x)`, `ceiling(x)` | округление вниз / вверх | `floor(-2.3)` → −3 |

## Встроенные математические функции

`sqrt`, `exp`, `log` (**натуральный!**), `log10`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2(y, x)`, `abs`, `mod`, `max`, `min`, `sign`, `hypot`.

> Тригонометрические функции принимают **радианы**. Градусы переводятся так: `rad = deg * pi / 180`.

```fortran
program functions
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: lat

  lat = 55.7_dp                                   ! широта Москвы, градусы
  print *, 'pi        =', pi
  print *, 'sin(55.7°)=', sin(lat * pi / 180.0_dp)
  print *, 'sqrt(2)   =', sqrt(2.0_dp)
  print *, 'ln(10)    =', log(10.0_dp), '  lg(10) =', log10(10.0_dp)
  print *, 'max       =', max(3.0, 7.5, -1.0)
  print *, 'atan2(1,-1) в градусах =', atan2(1.0_dp, -1.0_dp) * 180 / pi
end program functions
```

## Чтение чисел с клавиатуры (кратко)

`read(*,*) a, b` читает числа из стандартного ввода. Под ячейкой есть поле **⌨ ввод (stdin)**: всё, что в нём написано, программа получит так, будто это набрали на клавиатуре.

```fortran
program read_demo
  implicit none
  real :: t_celsius
  read(*,*) t_celsius
  print *, t_celsius, '°C =', t_celsius + 273.15, 'K'
end program read_demo
```
```stdin
12.5
```

~~~task
title: Параметр Кориолиса
---
Параметр Кориолиса $f = 2Ω sin φ$, где $Ω = 7.2921·10^-5$ рад/с — угловая скорость вращения Земли, $φ$ — широта.

Прочитайте широту в **градусах** (вещественное число) и выведите $f$ в с⁻¹.

**Пример.** Ввод `60` → вывод `1.263E-04` (формат вывода может быть любым, например `1.26302835E-04`).
@starter
program coriolis
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: omega = 7.2921e-5_dp
  real(dp) :: lat

  read(*,*) lat

end program coriolis
@solution
program coriolis
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: omega = 7.2921e-5_dp
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: lat
  read(*,*) lat
  print *, 2.0_dp * omega * sin(lat * pi / 180.0_dp)
end program coriolis
@hint
Не забудьте перевести градусы в радианы: `lat * pi / 180`.
@test
@stdin
60
@expect
1.263E-04
@test
@stdin
45
@expect
1.031E-04
@test южное полушарие
@stdin
-30
@expect
-7.292E-05
@test
@stdin
0
@expect
0.0
~~~

~~~task
title: Часы, минуты, секунды
---
Продолжительность измерения задана в секундах (целое число). Выведите её в виде трёх целых чисел: часы, минуты, секунды.

**Пример.** `3725` → `1 2 5`.
@starter
program hms
  implicit none
  integer :: total

  read(*,*) total

end program hms
@solution
program hms
  implicit none
  integer :: total
  read(*,*) total
  print *, total / 3600, mod(total, 3600) / 60, mod(total, 60)
end program hms
@hint
Целочисленное деление `/` и остаток `mod` — как раз то, что нужно.
@test
@stdin
3725
@expect
1 2 5
@test
@stdin
86399
@expect
23 59 59
@test
@stdin
59
@expect
0 0 59
@test
@stdin
7200
@expect
2 0 0
~~~

~~~task
title: Волны на глубокой воде
---
Для волн на глубокой воде фазовая скорость и длина волны выражаются через период $T$:

$c = gT / 2π$,   $λ = gT² / 2π$,   $g = 9.81$ м/с².

Прочитайте период $T$ (с) и выведите два числа: $c$ (м/с) и $λ$ (м).
@starter
program deep_waves
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: T

  read(*,*) T

end program deep_waves
@solution
program deep_waves
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: g = 9.81_dp, pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: T
  read(*,*) T
  print *, g * T / (2.0_dp * pi), g * T**2 / (2.0_dp * pi)
end program deep_waves
@hint
π удобно получить как `4*atan(1.0_dp)`.
@test
@stdin
10
@expect
15.613 156.13
@test
@stdin
6
@expect
9.368 56.21
@test зыбь
@stdin
16
@expect
24.98 399.7
~~~
