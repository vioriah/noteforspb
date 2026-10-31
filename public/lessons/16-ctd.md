# 16. Практикум: обработка профиля CTD

Соберём всё вместе: прочитаем файл зондирования, рассчитаем плотность, найдём **верхний квазиоднородный слой** (ВКС, *mixed layer*) и **термоклин**, приведём данные к стандартным горизонтам и запишем результат в файл.

Данные — тот же условный летний профиль из Баренцева моря:

```file ctd.txt
depth   temp    sal
  0     7.85   34.62
  5     7.84   34.62
 10     7.80   34.63
 15     7.71   34.64
 20     7.32   34.66
 25     6.40   34.72
 30     5.21   34.79
 40     4.12   34.86
 50     3.55   34.90
 75     2.98   34.93
100     2.61   34.95
125     2.35   34.96
150     2.18   34.97
200     1.92   34.98
```

## Шаг 1. Модуль для чтения профиля

Вынесем чтение в модуль: тогда его можно будет использовать в любой программе. Процедура сама считает строки, выделяет память и возвращает массивы.

```fortran
module ctd_io
  implicit none
  integer, parameter :: dp = kind(1.0d0)
contains
  subroutine read_profile(fname, z, t, s)
    character(len=*), intent(in) :: fname
    real(dp), allocatable, intent(out) :: z(:), t(:), s(:)
    integer :: u, ios, n, k
    open(newunit=u, file=fname, status='old', action='read')
    read(u, *)                              ! заголовок
    n = 0
    do
      read(u, *, iostat=ios)
      if (ios /= 0) exit
      n = n + 1
    end do
    allocate(z(n), t(n), s(n))
    rewind(u)
    read(u, *)
    do k = 1, n
      read(u, *) z(k), t(k), s(k)
    end do
    close(u)
  end subroutine read_profile

  pure function rho_eos80(s, t) result(rho)
    real(dp), intent(in) :: s, t
    real(dp) :: rho, rhow
    rhow = 999.842594_dp + t*(6.793952e-2_dp + t*(-9.095290e-3_dp + t*(1.001685e-4_dp &
           + t*(-1.120083e-6_dp + t*6.536332e-9_dp))))
    rho = rhow + s*(0.824493_dp + t*(-4.0899e-3_dp + t*(7.6438e-5_dp + t*(-8.2467e-7_dp + t*5.3875e-9_dp)))) &
          + s*sqrt(s)*(-5.72466e-3_dp + t*(1.0227e-4_dp - t*1.6546e-6_dp)) + 4.8314e-4_dp*s*s
  end function rho_eos80
end module ctd_io
```

## Шаг 2. Обзор профиля и σt

```fortran
program overview
  use ctd_io
  implicit none
  real(dp), allocatable :: z(:), t(:), s(:), sig(:)
  integer :: k, u
  call read_profile('ctd.txt', z, t, s)
  allocate(sig(size(z)))
  do k = 1, size(z)
    sig(k) = rho_eos80(s(k), t(k)) - 1000.0_dp
  end do
  open(newunit=u, file='sigma.txt', status='replace')
  write(u, '(A)') '# depth  temp    sal   sigma_t'
  do k = 1, size(z)
    write(u, '(F6.0, 2F8.2, F9.3)') z(k), t(k), s(k), sig(k)
    print '(F6.0, 2F8.2, F9.3)', z(k), t(k), s(k), sig(k)
  end do
  close(u)
  print *, '# Перепад σt в слое:', sig(size(z)) - sig(1)
end program overview
```

Постройте график в режиме «вертикальный профиль», выбрав столбец Y = 2 (температура) или 4 (σt).

## Шаг 3. Верхний квазиоднородный слой и термоклин

**Толщину ВКС** часто определяют по *пороговому критерию*: это глубина, на которой температура впервые отличается от температуры у поверхности (или на опорном горизонте 10 м) на заданную величину. Распространённый порог — $ΔT = 0.2$ °C (de Boyer Montégut et al., 2004). Точное положение границы находим линейной интерполяцией между соседними горизонтами.

**Термоклин** — слой с наибольшим вертикальным градиентом температуры $−ΔT/Δz$.

```fortran
program mld_demo
  use ctd_io
  implicit none
  real(dp), allocatable :: z(:), t(:), s(:), grad(:)
  real(dp) :: tref, mld
  integer :: k, n
  call read_profile('ctd.txt', z, t, s)
  n = size(z)
  tref = t(1)
  mld = z(n)                       ! если порог не достигнут — весь профиль однороден
  do k = 2, n
    if (t(k) < tref - 0.2_dp) then
      ! интерполируем глубину, где T = tref - 0.2
      mld = z(k-1) + (tref - 0.2_dp - t(k-1)) * (z(k) - z(k-1)) / (t(k) - t(k-1))
      exit
    end if
  end do
  print '(A, F7.2, A)', 'Толщина ВКС: ', mld, ' м'
  allocate(grad(n-1))
  grad = -(t(2:n) - t(1:n-1)) / (z(2:n) - z(1:n-1))
  k = maxloc(grad, 1)
  print '(A, F6.1, A, F6.1, A, F7.4, A)', 'Термоклин: слой ', z(k), '–', z(k+1), ' м, градиент ', grad(k), ' °C/м'
end program mld_demo
```

~~~task
title: Толщина ВКС
---
В файле `ctd.txt` — заголовок и столбцы `глубина температура солёность`. Найдите толщину верхнего квазиоднородного слоя по критерию $ΔT = 0.2$ °C относительно **первого** (верхнего) измерения, интерполируя глубину линейно, и выведите её. Гарантируется, что порог достигается.
@starter
program mld
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), allocatable :: z(:), t(:), s(:)
  integer :: u, ios, n, k

  open(newunit=u, file='ctd.txt', status='old', action='read')

  close(u)
end program mld
@solution
program mld
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), allocatable :: z(:), t(:), s(:)
  real(dp) :: tc
  integer :: u, ios, n, k
  open(newunit=u, file='ctd.txt', status='old', action='read')
  read(u, *)
  n = 0
  do
    read(u, *, iostat=ios)
    if (ios /= 0) exit
    n = n + 1
  end do
  allocate(z(n), t(n), s(n))
  rewind(u)
  read(u, *)
  do k = 1, n
    read(u, *) z(k), t(k), s(k)
  end do
  close(u)
  tc = t(1) - 0.2_dp
  do k = 2, n
    if (t(k) < tc) then
      print *, z(k-1) + (tc - t(k-1)) * (z(k) - z(k-1)) / (t(k) - t(k-1))
      exit
    end if
  end do
end program mld
@hint
Ищите первый горизонт $k$, где $T_k < T_1 − 0.2$. Граница ВКС лежит между $z_{k−1}$ и $z_k$.
@test Баренцево море
@file ctd.txt
depth   temp    sal
  0     7.85   34.62
  5     7.84   34.62
 10     7.80   34.63
 15     7.71   34.64
 20     7.32   34.66
 25     6.40   34.72
 30     5.21   34.79
 40     4.12   34.86
@expect
15.77
@test
@file ctd.txt
z T S
0 24.0 18.1
10 23.9 18.1
20 23.85 18.1
30 21.0 18.3
50 9.0 18.5
@expect
20.18
@test тонкий слой
@file ctd.txt
z T S
0 10.0 35
2 9.9 35
4 9.7 35
6 9.0 35
@expect
3.0
~~~

~~~task
title: Термоклин
---
По файлу `ctd.txt` (заголовок + `глубина температура солёность`) найдите слой между соседними горизонтами с наибольшим градиентом $−ΔT/Δz$. Выведите глубину **середины** этого слоя и градиент (°C/м).
@starter
program thermocline
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), allocatable :: z(:), t(:), s(:)
  integer :: u, ios, n, k

  open(newunit=u, file='ctd.txt', status='old', action='read')

  close(u)
end program thermocline
@solution
program thermocline
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), allocatable :: z(:), t(:), s(:), g(:)
  integer :: u, ios, n, k
  open(newunit=u, file='ctd.txt', status='old', action='read')
  read(u, *)
  n = 0
  do
    read(u, *, iostat=ios)
    if (ios /= 0) exit
    n = n + 1
  end do
  allocate(z(n), t(n), s(n), g(n-1))
  rewind(u)
  read(u, *)
  do k = 1, n
    read(u, *) z(k), t(k), s(k)
  end do
  close(u)
  g = -(t(2:n) - t(1:n-1)) / (z(2:n) - z(1:n-1))
  k = maxloc(g, 1)
  print *, (z(k) + z(k+1)) / 2, g(k)
end program thermocline
@test Баренцево море
@file ctd.txt
depth   temp    sal
  0     7.85   34.62
 10     7.80   34.63
 20     7.32   34.66
 25     6.40   34.72
 30     5.21   34.79
 40     4.12   34.86
 50     3.55   34.90
@expect
27.5 0.238
@test Чёрное море
@file ctd.txt
z T S
0 24.1 18.10
10 23.8 18.12
20 15.2 18.30
30 9.1 18.45
50 7.4 18.70
@expect
15.0 0.86
~~~

~~~task
title: Стандартные горизонты в файл
---
Прочитайте `ctd.txt` и запишите в файл `std.txt` температуру и солёность на **стандартных горизонтах** 0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500 м, которые попадают в диапазон глубин профиля. Используйте линейную интерполяцию. Каждая строка файла — `глубина T S` в формате `(F6.0, F8.3, F8.3)`.
@starter
program std_horizons
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: zs(14) = [0., 10., 20., 30., 50., 75., 100., 125., 150., 200., 250., 300., 400., 500.]
  real(dp), allocatable :: z(:), t(:), s(:)
  integer :: u, ios, n, k

  open(newunit=u, file='ctd.txt', status='old', action='read')

  close(u)
end program std_horizons
@solution
program std_horizons
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: zs(14) = [0., 10., 20., 30., 50., 75., 100., 125., 150., 200., 250., 300., 400., 500.]
  real(dp), allocatable :: z(:), t(:), s(:)
  real(dp) :: w
  integer :: u, ios, n, k, i
  open(newunit=u, file='ctd.txt', status='old', action='read')
  read(u, *)
  n = 0
  do
    read(u, *, iostat=ios)
    if (ios /= 0) exit
    n = n + 1
  end do
  allocate(z(n), t(n), s(n))
  rewind(u)
  read(u, *)
  do k = 1, n
    read(u, *) z(k), t(k), s(k)
  end do
  close(u)
  open(newunit=u, file='std.txt', status='replace', action='write')
  do k = 1, size(zs)
    do i = 1, n - 1
      if (zs(k) >= z(i) .and. zs(k) <= z(i+1)) then
        w = (zs(k) - z(i)) / (z(i+1) - z(i))
        write(u, '(F6.0, F8.3, F8.3)') zs(k), t(i) + w * (t(i+1) - t(i)), s(i) + w * (s(i+1) - s(i))
        exit
      end if
    end do
  end do
  close(u)
end program std_horizons
@hint
Для каждого стандартного горизонта ищите отрезок $[z_i, z_{i+1}]$, который его содержит. Если такого нет — горизонт пропускается.
@test
@file ctd.txt
depth temp sal
2 7.85 34.62
13 7.71 34.64
27 5.90 34.75
44 3.90 34.88
88 2.75 34.94
160 2.10 34.97
@expectfile std.txt
10. 7.748 34.635
20. 6.805 34.695
30. 5.547 34.773
50. 3.743 34.888
75. 3.090 34.922
100. 2.642 34.945
125. 2.416 34.955
150. 2.190 34.966
@test
@file ctd.txt
z T S
0 3.0 33.0
600 1.0 34.8
@expectfile std.txt
0. 3.000 33.000
10. 2.967 33.030
20. 2.933 33.060
30. 2.900 33.090
50. 2.833 33.150
75. 2.750 33.225
100. 2.667 33.300
125. 2.583 33.375
150. 2.500 33.450
200. 2.333 33.600
250. 2.167 33.750
300. 2.000 33.900
400. 1.667 34.200
500. 1.333 34.500
~~~
