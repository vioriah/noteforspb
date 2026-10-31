# 13. Интерполяция и метод наименьших квадратов

## Линейная интерполяция

Батометрические и CTD-данные получают на разных горизонтах, а для сравнения станций и построения разрезов их приводят к **стандартным горизонтам**: 0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500 м и т. д.

Если $z_i ≤ z ≤ z_{i+1}$, то

$f(z) ≈ f_i + (f_{i+1} − f_i) · (z − z_i) / (z_{i+1} − z_i)$.

Алгоритм: найти отрезок, в который попадает $z$, и применить формулу.

```fortran
program interpolation
  implicit none
  real :: z(7) = [0., 8., 17., 31., 48., 77., 103.]          ! горизонты измерений
  real :: t(7) = [8.2, 8.1, 7.6, 4.9, 2.6, 1.4, 1.1]
  real :: zs(7) = [0., 10., 20., 30., 50., 75., 100.]        ! стандартные горизонты
  integer :: k
  do k = 1, size(zs)
    print '(F6.0, F8.3)', zs(k), interp(z, t, zs(k))
  end do
contains
  ! линейная интерполяция; x — по возрастанию; за пределами — значение -999
  pure real function interp(x, y, x0)
    real, intent(in) :: x(:), y(:), x0
    integer :: i
    interp = -999.0
    do i = 1, size(x) - 1
      if (x0 >= x(i) .and. x0 <= x(i+1)) then
        interp = y(i) + (y(i+1) - y(i)) * (x0 - x(i)) / (x(i+1) - x(i))
        return                   ! досрочный выход из функции
      end if
    end do
  end function interp
end program interpolation
```

## Метод наименьших квадратов: линейный тренд

Есть ряд $(x_i, y_i)$, например год и среднегодовая температура. Ищем прямую $y = a + bx$, для которой сумма квадратов отклонений $Σ (y_i − a − bx_i)²$ минимальна. Приравняв производные по $a$ и $b$ к нулю, получим:

$b = Σ (x_i − x̄)(y_i − ȳ) / Σ (x_i − x̄)²$,   $a = ȳ − b x̄$.

Насколько хорошо прямая описывает данные, показывает **коэффициент корреляции**

$r = Σ (x_i − x̄)(y_i − ȳ) / √( Σ (x_i − x̄)² · Σ (y_i − ȳ)² )$.

```fortran
program linear_trend
  implicit none
  integer, parameter :: n = 12
  real :: year(n), t(n), a, b, r, xm, ym
  integer :: i
  ! условный ряд аномалий температуры воды, °C
  year = [(real(2013 + i), i = 1, n)]
  t = [0.12, 0.05, 0.31, 0.22, 0.18, 0.40, 0.35, 0.29, 0.51, 0.47, 0.44, 0.62]
  xm = sum(year) / n
  ym = sum(t) / n
  b = sum((year - xm) * (t - ym)) / sum((year - xm)**2)
  a = ym - b * xm
  r = sum((year - xm) * (t - ym)) / sqrt(sum((year - xm)**2) * sum((t - ym)**2))
  print '(A, F7.4, A)', 'Тренд: ', b * 10, ' °C за 10 лет'
  print '(A, F6.3)', 'Коэффициент корреляции r = ', r
  print *
  do i = 1, n
    print '(F7.0, 2F8.3)', year(i), t(i), a + b * year(i)   ! данные и линия тренда
  end do
end program linear_trend
```

Постройте график (кнопка **📈**): X — столбец 1, Y — столбцы 2 и 3.

> **Вычислительная тонкость.** Формулы с отклонениями от среднего ($x_i − x̄$) устойчивее, чем «школьная» формула через $Σx_i²$ и $(Σx_i)²$. Когда $x$ — это годы (≈2000), $Σx_i²$ ≈ 10⁸ и в одинарной точности теряются почти все значащие цифры.

~~~task
title: Стандартные горизонты
---
Сначала даны $n$ и $n$ строк `z T` (глубины по возрастанию), затем $m$ и $m$ глубин, на которые нужно проинтерполировать температуру. Все целевые глубины лежат в пределах данных. Выведите $m$ строк вида `глубина температура`.
@starter
program std_levels
  implicit none
  real, allocatable :: z(:), t(:), zs(:)
  integer :: n, m, i

  read(*,*) n
  allocate(z(n), t(n))
  do i = 1, n
    read(*,*) z(i), t(i)
  end do
  read(*,*) m
  allocate(zs(m))
  read(*,*) zs

end program std_levels
@solution
program std_levels
  implicit none
  real, allocatable :: z(:), t(:), zs(:)
  integer :: n, m, i, k
  read(*,*) n
  allocate(z(n), t(n))
  do i = 1, n
    read(*,*) z(i), t(i)
  end do
  read(*,*) m
  allocate(zs(m))
  read(*,*) zs
  do k = 1, m
    do i = 1, n - 1
      if (zs(k) >= z(i) .and. zs(k) <= z(i+1)) then
        print *, zs(k), t(i) + (t(i+1) - t(i)) * (zs(k) - z(i)) / (z(i+1) - z(i))
        exit
      end if
    end do
  end do
end program std_levels
@hint
Для каждой целевой глубины перебирайте отрезки `i = 1 … n−1` и, найдя подходящий, выходите из цикла (`exit`).
@test
@stdin
7
0 8.2
8 8.1
17 7.6
31 4.9
48 2.6
77 1.4
103 1.1
6
0 10 20 30 50 100
@expect
0 8.2
10 7.9889
20 7.0214
30 5.0929
50 2.5172
100 1.1346
@test точно на горизонтах
@stdin
3
0 5
50 3
100 1
3
0 50 100
@expect
0 5
50 3
100 1
~~~

~~~task
title: Линейный тренд
---
Даны $n$ и $n$ строк `x y`. Найдите методом наименьших квадратов коэффициенты прямой $y = a + bx$ и коэффициент корреляции $r$. Выведите $a$, $b$, $r$. Используйте двойную точность.
@starter
program lsq
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), allocatable :: x(:), y(:)
  integer :: n, i

  read(*,*) n
  allocate(x(n), y(n))
  do i = 1, n
    read(*,*) x(i), y(i)
  end do

end program lsq
@solution
program lsq
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), allocatable :: x(:), y(:)
  real(dp) :: xm, ym, a, b, r
  integer :: n, i
  read(*,*) n
  allocate(x(n), y(n))
  do i = 1, n
    read(*,*) x(i), y(i)
  end do
  xm = sum(x) / n
  ym = sum(y) / n
  b = sum((x - xm) * (y - ym)) / sum((x - xm)**2)
  a = ym - b * xm
  r = sum((x - xm) * (y - ym)) / sqrt(sum((x - xm)**2) * sum((y - ym)**2))
  print *, a, b, r
end program lsq
@test точная прямая
@stdin
4
0 1
1 3
2 5
3 7
@expect
1.0 2.0 1.0
@test
@stdin
5
1 2.1
2 3.9
3 6.2
4 7.8
5 10.1
@expect
0.05 1.99 0.99865
@test убывающая зависимость
@stdin
4
2000 10.0
2010 9.0
2020 8.5
2030 7.5
@expect
169.95 -0.08 -0.99228
~~~
