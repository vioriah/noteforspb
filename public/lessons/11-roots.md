# 11. Решение нелинейных уравнений

Многие задачи сводятся к уравнению $F(x) = 0$, которое не решается аналитически. Например, длину волны $λ$ на воде глубины $h$ при периоде $T$ задаёт **дисперсионное соотношение** линейной теории волн:

$ω² = g k · tanh(k h)$,   где $ω = 2π/T$, $k = 2π/λ$.

На глубокой воде ($kh ≫ 1$, $tanh → 1$) получаем $λ = gT²/2π$ (урок 2), на мелкой ($kh ≪ 1$) — $c = √(gh)$. В промежуточном случае уравнение решают **численно**.

## Метод половинного деления (бисекция)

Если $F$ непрерывна на $[a, b]$ и $F(a)·F(b) < 0$, то корень внутри отрезка. Делим отрезок пополам и оставляем ту половину, на концах которой $F$ имеет разные знаки. За каждый шаг погрешность уменьшается вдвое: чтобы получить точность $ε$, нужно около $log_2((b − a)/ε)$ шагов.

```fortran
program bisection
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: a, b, c
  integer :: iter
  a = 2.0_dp
  b = 3.0_dp
  iter = 0
  do while (b - a > 1.0e-10_dp)
    c = (a + b) / 2
    if (f(a) * f(c) <= 0.0_dp) then
      b = c
    else
      a = c
    end if
    iter = iter + 1
  end do
  print *, 'корень =', (a + b) / 2, '  итераций:', iter
contains
  pure function f(x)
    real(dp), intent(in) :: x
    real(dp) :: f
    f = x**3 - 2*x - 5           ! знаменитое уравнение Валлиса
  end function f
end program bisection
```

**Плюсы:** надёжен, всегда сходится. **Минусы:** медленный, нужен отрезок со сменой знака.

## Метод Ньютона (касательных)

$x_{n+1} = x_n − F(x_n) / F'(x_n)$

Вблизи корня число верных знаков примерно **удваивается** на каждом шаге (квадратичная сходимость). Но нужна производная, а при плохом начальном приближении метод может разойтись.

```fortran
program newton
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: x, dx
  integer :: iter
  x = 2.0_dp                      ! начальное приближение
  do iter = 1, 50
    dx = f(x) / df(x)
    x = x - dx
    print '(I3, F22.16, ES12.3)', iter, x, abs(dx)
    if (abs(dx) < 1.0e-14_dp) exit
  end do
contains
  pure real(dp) function f(x)
    real(dp), intent(in) :: x
    f = x**3 - 2*x - 5
  end function f
  pure real(dp) function df(x)
    real(dp), intent(in) :: x
    df = 3*x**2 - 2
  end function df
end program newton
```

Посмотрите на третий столбец: поправка убывает как $10^-1, 10^-3, 10^-6, 10^-12…$ Это и есть квадратичная сходимость.

## Длина волны на воде конечной глубины

Решим дисперсионное соотношение методом Ньютона относительно $k$. Положим $F(k) = g k tanh(kh) − ω²$. Тогда $F'(k) = g tanh(kh) + g k h / cosh²(kh)$. Начальное приближение берём из формулы для глубокой воды: $k_0 = ω²/g$.

```fortran
program dispersion
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: g = 9.81_dp, pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: t, h, k
  integer :: i
  t = 8.0_dp
  print '(A)', '   h, м    L, м     c, м/с   sqrt(g*h)'
  do i = 1, 8
    h = 2.0_dp ** (i - 1)        ! 1, 2, 4, ... 128 м
    k = wavenumber(t, h)
    print '(F7.0, 3F10.2)', h, 2*pi/k, 2*pi/k/t, sqrt(g*h)
  end do
  print '(A, F8.2)', ' глубокая вода: L =', g * t**2 / (2*pi)
contains
  function wavenumber(period, depth) result(k)
    real(dp), intent(in) :: period, depth
    real(dp) :: k, omega, dk
    integer :: it
    omega = 2*pi / period
    k = omega**2 / g
    do it = 1, 100
      dk = (g*k*tanh(k*depth) - omega**2) / (g*tanh(k*depth) + g*k*depth / cosh(k*depth)**2)
      k = k - dk
      if (abs(dk) < 1.0e-12_dp * k) exit
    end do
  end function wavenumber
end program dispersion
```

При малой глубине фазовая скорость $c = L/T$ приближается к $√(gh)$: волна «чувствует дно».

~~~task
title: Бисекция
---
Найдите методом половинного деления корень уравнения $e^{−x} = x$ на отрезке $[a, b]$ с точностью $10^-8$. Программа читает $a$ и $b$ (гарантируется, что на концах функция $F(x) = e^{−x} − x$ имеет разные знаки) и печатает корень.
@starter
program bisect
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: a, b, c

  read(*,*) a, b

contains

  pure real(dp) function f(x)
    real(dp), intent(in) :: x
    f = exp(-x) - x
  end function f

end program bisect
@solution
program bisect
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: a, b, c
  read(*,*) a, b
  do while (b - a > 1.0e-8_dp)
    c = (a + b) / 2
    if (f(a) * f(c) <= 0.0_dp) then
      b = c
    else
      a = c
    end if
  end do
  print *, (a + b) / 2
contains
  pure real(dp) function f(x)
    real(dp), intent(in) :: x
    f = exp(-x) - x
  end function f
end program bisect
@test
@stdin
0 1
@expect
0.5671433
@test
@stdin
-2 5
@expect
0.5671433
~~~

~~~task
title: Длина волны на мелководье
---
Прочитайте период волны $T$ (с) и глубину $h$ (м). Решите дисперсионное соотношение $ω² = gk·tanh(kh)$ ($g = 9.81$) любым численным методом и выведите длину волны $λ = 2π/k$ в метрах (точность — сотые доли метра).
@starter
program wavelength
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: g = 9.81_dp, pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: t, h, k

  read(*,*) t, h

end program wavelength
@solution
program wavelength
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: g = 9.81_dp, pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: t, h, k, omega, dk
  integer :: it
  read(*,*) t, h
  omega = 2*pi / t
  k = omega**2 / g
  do it = 1, 100
    dk = (g*k*tanh(k*h) - omega**2) / (g*tanh(k*h) + g*k*h / cosh(k*h)**2)
    k = k - dk
    if (abs(dk) < 1.0e-12_dp * k) exit
  end do
  print *, 2*pi / k
end program wavelength
@hint
Метод Ньютона: $F(k) = gk·tanh(kh) − ω²$, $F'(k) = g·tanh(kh) + gkh / cosh²(kh)$, начальное приближение $k_0 = ω²/g$.
@hint
Подойдёт и бисекция по $k$ на отрезке, например, $[10^-6, 10]$.
@test
@stdin
10 10
@expect
92.37
@test глубокая вода
@stdin
8 200
@expect
99.92
@test
@stdin
12 5
@expect
82.08
@test
@stdin
5 20
@expect
38.91
~~~
