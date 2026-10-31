# 9. Модули и производные типы

## Зачем нужны модули

Внутренние процедуры (`contains` в программе) видны только этой программе. Если одни и те же константы и функции нужны в нескольких программах, их выносят в **модуль**:

```f90
module имя
  implicit none
  ! константы, переменные, типы
contains
  ! процедуры
end module имя
```

Подключение — оператор `use` **в самом начале** программы, до `implicit none`:

```f90
program main
  use имя                   ! всё публичное из модуля
  use другой, only: g, pi   ! только перечисленное
  implicit none
```

Модуль даёт:

- **общие константы** (одно определение `g`, `pi`, `omega` на весь проект);
- **проверку интерфейсов**: компилятор проверяет типы аргументов при вызове процедур модуля;
- **инкапсуляцию**: `private` скрывает внутренние детали, `public` открывает интерфейс.

В больших моделях океана каждый файл — это модуль: `module ocean_dynamics`, `module sea_ice`, `module io_netcdf`…

## Модули в этом блокноте

Ячейка, которая содержит **только модуль**, помечается значком «модуль». При запуске любой ячейки ниже все модули из ячеек **выше** компилируются вместе с ней. Запустите ячейку с модулем (проверится, что он компилируется), затем программу под ней.

```fortran
module constants
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
  real(dp), parameter :: g = 9.80665_dp          ! м/с²
  real(dp), parameter :: omega = 7.2921e-5_dp    ! рад/с
  real(dp), parameter :: r_earth = 6371.0e3_dp   ! м
  real(dp), parameter :: deg2rad = pi / 180.0_dp
end module constants
```

```fortran
module geophysics
  use constants
  implicit none
  private                       ! по умолчанию всё скрыто…
  public :: coriolis, rossby_radius   ! …кроме этого

contains

  pure function coriolis(lat) result(f)
    real(dp), intent(in) :: lat     ! градусы
    real(dp) :: f
    f = 2.0_dp * omega * sin(lat * deg2rad)
  end function coriolis

  ! баротропный радиус деформации Россби: R = sqrt(g*H)/|f|
  pure function rossby_radius(depth, lat) result(r)
    real(dp), intent(in) :: depth, lat
    real(dp) :: r
    r = sqrt(g * depth) / abs(coriolis(lat))
  end function rossby_radius

end module geophysics
```

```fortran
program use_modules
  use constants, only: dp
  use geophysics
  implicit none
  real(dp) :: lat
  integer :: k
  print '(A)', ' широта      f, 1/с     R (H=4000 м), км'
  do k = 1, 4
    lat = 15.0_dp * k
    print '(F7.1, ES13.4, F14.0)', lat, coriolis(lat), rossby_radius(4000.0_dp, lat) / 1000
  end do
end program use_modules
```

> `pure` означает, что функция не имеет побочных эффектов (не печатает, не меняет глобальные переменные). Компилятору это даёт больше возможностей для оптимизации, а читателю — гарантию.

## Производные типы (`type`)

Станция — это не одно число, а набор разнородных данных: название, координаты, глубина. Их удобно объединить в **производный тип** (аналог структуры в C или записи):

```fortran
program derived_types
  implicit none
  type :: station
    character(len=16) :: name
    real :: lat, lon
    real :: depth
  end type station

  type(station) :: st(3)
  integer :: k

  st(1) = station('Kola-1', 69.5, 33.5, 160.0)     ! конструктор типа
  st(2) = station('Kola-5', 71.5, 33.5, 270.0)
  st(3)%name = 'Kola-8'                             ! обращение к полю: %
  st(3)%lat = 73.0
  st(3)%lon = 33.5
  st(3)%depth = 300.0

  do k = 1, size(st)
    print '(A10, 2F8.2, F8.0)', st(k)%name, st(k)%lat, st(k)%lon, st(k)%depth
  end do
  print *, 'Средняя глубина:', sum(st%depth) / size(st)   ! массив полей!
end program derived_types
```

Запись `st%depth` для массива структур даёт массив глубин всех станций — к нему применимы `sum`, `maxloc` и т. д.

~~~task
title: Модуль «геофизика»
---
Создайте модуль `geo` с двумя функциями:

- `coriolis(lat)` — параметр Кориолиса $f = 2Ω sin φ$, $Ω = 7.2921·10^-5$ рад/с;
- `inertial_period(lat)` — период инерционных колебаний $T = 2π / |f|$ **в часах**.

Программа (в той же ячейке, после модуля) читает широту и печатает $f$ и $T$.
@starter
module geo
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: omega = 7.2921e-5_dp
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
contains

  pure function coriolis(lat) result(f)
    real(dp), intent(in) :: lat
    real(dp) :: f
    f = 0.0_dp   ! TODO
  end function coriolis

  pure function inertial_period(lat) result(t)
    real(dp), intent(in) :: lat
    real(dp) :: t
    t = 0.0_dp   ! TODO
  end function inertial_period

end module geo

program inertial
  use geo
  implicit none
  real(dp) :: lat
  read(*,*) lat
  print *, coriolis(lat), inertial_period(lat)
end program inertial
@solution
module geo
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: omega = 7.2921e-5_dp
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
contains
  pure function coriolis(lat) result(f)
    real(dp), intent(in) :: lat
    real(dp) :: f
    f = 2.0_dp * omega * sin(lat * pi / 180.0_dp)
  end function coriolis

  pure function inertial_period(lat) result(t)
    real(dp), intent(in) :: lat
    real(dp) :: t
    t = 2.0_dp * pi / abs(coriolis(lat)) / 3600.0_dp
  end function inertial_period
end module geo

program inertial
  use geo
  implicit none
  real(dp) :: lat
  read(*,*) lat
  print *, coriolis(lat), inertial_period(lat)
end program inertial
@hint
Функции модуля пишутся после `contains`. Внутри `inertial_period` можно вызвать `coriolis`.
@test
@stdin
45
@expect
1.0313E-04 16.92
@test
@stdin
30
@expect
7.2921E-05 23.93
@test
@stdin
-70
@expect
-1.3705E-04 12.74
~~~

~~~task
title: Самая глубокая станция
---
Опишите тип `station` с полями `name` (строка), `lat`, `lon`, `depth`. Программа читает число станций $n$, затем $n$ строк вида `имя широта долгота глубина`. Выведите **два** названия: самой глубокой станции и самой северной.
@starter
program deepest
  implicit none
  type :: station
    character(len=20) :: name
    real :: lat, lon, depth
  end type station
  type(station), allocatable :: st(:)
  integer :: n, k

  read(*,*) n
  allocate(st(n))
  do k = 1, n
    read(*,*) st(k)%name, st(k)%lat, st(k)%lon, st(k)%depth
  end do

end program deepest
@solution
program deepest
  implicit none
  type :: station
    character(len=20) :: name
    real :: lat, lon, depth
  end type station
  type(station), allocatable :: st(:)
  integer :: n, k
  read(*,*) n
  allocate(st(n))
  do k = 1, n
    read(*,*) st(k)%name, st(k)%lat, st(k)%lon, st(k)%depth
  end do
  print '(A)', trim(st(maxloc(st%depth, 1))%name)
  print '(A)', trim(st(maxloc(st%lat, 1))%name)
end program deepest
@hint
`maxloc(st%depth, 1)` — номер станции с наибольшей глубиной. Не забудьте `trim` при печати имени.
@test
@stdin
3
Kola-1 69.5 33.5 160
Kola-5 71.5 33.5 270
Kola-8 73.0 33.5 250
@expect
Kola-5
Kola-8
@test
@stdin
4
A 10.0 140.0 5200
B 11.3 142.2 10900
C -5.0 150.0 7000
D 12.0 145.0 3000
@expect
B
D
~~~
