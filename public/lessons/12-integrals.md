# 12. Численное интегрирование

Интегралы в океанологии встречаются постоянно: теплосодержание столба воды $Q = ρc_p∫T dz$, пресноводный эквивалент, динамическая высота, расход через разрез $∫∫ v dx dz$. Данные при этом заданы **в точках**, часто с неравномерным шагом.

## Квадратурные формулы

Разобьём $[a, b]$ на $n$ отрезков с шагом $h = (b − a)/n$, $x_i = a + ih$, $f_i = f(x_i)$.

| Метод | Формула | Погрешность |
|---|---|---|
| средних прямоугольников | $h · Σ f(x_i + h/2)$ | $O(h²)$ |
| трапеций | $h · [f_0/2 + f_1 + … + f_{n−1} + f_n/2]$ | $O(h²)$ |
| Симпсона ($n$ чётное) | $h/3 · [f_0 + 4f_1 + 2f_2 + 4f_3 + … + 4f_{n−1} + f_n]$ | $O(h⁴)$ |

Погрешность $O(h²)$ означает: уменьшили шаг вдвое — ошибка уменьшилась в 4 раза. Для $O(h⁴)$ — в 16 раз.

```fortran
program quadratures
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
  integer :: n
  ! точное значение интеграла sin(x) от 0 до pi равно 2
  print '(A)', '    n    прямоуг.        трапеции        Симпсон'
  n = 4
  do while (n <= 256)
    print '(I5, 3ES16.6)', n, midpoint(0.0_dp, pi, n) - 2, trapezoid(0.0_dp, pi, n) - 2, simpson(0.0_dp, pi, n) - 2
    n = n * 2
  end do
  print *, '(в таблице — ошибки: значение минус точный ответ)'
contains
  pure real(dp) function f(x)
    real(dp), intent(in) :: x
    f = sin(x)
  end function f

  pure real(dp) function midpoint(a, b, n)
    real(dp), intent(in) :: a, b
    integer, intent(in) :: n
    real(dp) :: h
    integer :: i
    h = (b - a) / n
    midpoint = 0
    do i = 0, n - 1
      midpoint = midpoint + f(a + (i + 0.5_dp) * h)
    end do
    midpoint = midpoint * h
  end function midpoint

  pure real(dp) function trapezoid(a, b, n)
    real(dp), intent(in) :: a, b
    integer, intent(in) :: n
    real(dp) :: h
    integer :: i
    h = (b - a) / n
    trapezoid = (f(a) + f(b)) / 2
    do i = 1, n - 1
      trapezoid = trapezoid + f(a + i * h)
    end do
    trapezoid = trapezoid * h
  end function trapezoid

  pure real(dp) function simpson(a, b, n)
    real(dp), intent(in) :: a, b
    integer, intent(in) :: n        ! должно быть чётным
    real(dp) :: h
    integer :: i
    h = (b - a) / n
    simpson = f(a) + f(b)
    do i = 1, n - 1
      if (mod(i, 2) == 1) then
        simpson = simpson + 4 * f(a + i * h)
      else
        simpson = simpson + 2 * f(a + i * h)
      end if
    end do
    simpson = simpson * h / 3
  end function simpson
end program quadratures
```

Проследите по таблице: при удвоении $n$ ошибка трапеций уменьшается в ~4 раза, а Симпсона — в ~16.

## Интеграл по данным с неравномерным шагом

Измерения на станции сделаны на горизонтах 0, 10, 20, 30, 50, 75, 100… — шаг неравномерный. Формула трапеций легко обобщается: каждый отрезок даёт площадь трапеции.

$∫ f dz ≈ Σ (z_{i+1} − z_i)·(f_i + f_{i+1})/2$

С операциями над массивами это одна строка:

```fortran
program trapz_data
  implicit none
  real :: z(9) = [0., 10., 20., 30., 50., 75., 100., 150., 200.]
  real :: t(9) = [8.1, 8.0, 7.2, 4.5, 2.1, 1.3, 1.1, 0.9, 0.8]
  real :: integral
  integer :: n
  real, parameter :: rho = 1025.0, cp = 3990.0
  n = size(z)
  integral = sum((z(2:n) - z(1:n-1)) * (t(2:n) + t(1:n-1)) / 2)
  print *, 'Интеграл T dz, °C·м:', integral
  print *, 'Средняя температура слоя:', integral / (z(n) - z(1))
  print '(A, ES10.3, A)', ' Теплосодержание относительно 0 °C: ', rho * cp * integral, ' Дж/м²'
end program trapz_data
```

~~~task
title: Формула Симпсона
---
Вычислите по формуле Симпсона интеграл $∫_a^b e^{−x²} dx$. Программа читает $a$, $b$ и чётное $n$ и печатает значение.
@starter
program simpson_task
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: a, b
  integer :: n

  read(*,*) a, b, n

end program simpson_task
@solution
program simpson_task
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: a, b, h, s
  integer :: n, i
  read(*,*) a, b, n
  h = (b - a) / n
  s = f(a) + f(b)
  do i = 1, n - 1
    if (mod(i, 2) == 1) then
      s = s + 4 * f(a + i * h)
    else
      s = s + 2 * f(a + i * h)
    end if
  end do
  print *, s * h / 3
contains
  pure real(dp) function f(x)
    real(dp), intent(in) :: x
    f = exp(-x**2)
  end function f
end program simpson_task
@hint
Коэффициенты: 1 для концов, 4 для нечётных $i$, 2 для чётных внутренних $i$.
@test
@stdin
0 1 10
@expect
0.746825
@test
@stdin
0 1 2
@expect
0.747180
@test
@stdin
-2 2 100
@expect
1.764163
~~~

~~~task
title: Средняя температура слоя
---
Заданы $n$, затем $n$ строк `z T` — глубины (по возрастанию, шаг может быть неравномерным) и температура. Методом трапеций вычислите и выведите:

1. интеграл $∫T dz$ от первой до последней глубины;
2. среднюю температуру слоя $T̄ = ∫T dz / (z_n − z_1)$.
@starter
program layer_mean
  implicit none
  real, allocatable :: z(:), t(:)
  integer :: n, i

  read(*,*) n
  allocate(z(n), t(n))
  do i = 1, n
    read(*,*) z(i), t(i)
  end do

end program layer_mean
@solution
program layer_mean
  implicit none
  real, allocatable :: z(:), t(:)
  real :: q
  integer :: n, i
  read(*,*) n
  allocate(z(n), t(n))
  do i = 1, n
    read(*,*) z(i), t(i)
  end do
  q = sum((z(2:n) - z(1:n-1)) * (t(2:n) + t(1:n-1)) / 2)
  print *, q, q / (z(n) - z(1))
end program layer_mean
@test
@stdin
3
0 10
10 8
20 6
@expect
160 8
@test
@stdin
4
0 20
5 20
25 10
100 4
@expect
925 9.25
@test
@stdin
2
10 3.5
60 3.5
@expect
175 3.5
~~~
