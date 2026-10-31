# 14. Обыкновенные дифференциальные уравнения

Модели океана — это, по сути, большие системы дифференциальных уравнений, которые шаг за шагом интегрируются по времени. Разберём основные идеи на простых примерах.

Задача Коши: $dy/dt = f(t, y)$, $y(t_0) = y_0$. Найти $y(t)$ на сетке $t_n = t_0 + n·Δt$.

## Метод Эйлера

$y_{n+1} = y_n + Δt · f(t_n, y_n)$

Это самый простой метод: делаем шаг по касательной. Погрешность на конечном интервале — $O(Δt)$ (первый порядок).

**Пример — релаксация температуры поверхности.** Перемешанный слой охлаждается к температуре воздуха $T_a$ с характерным временем $τ$:

$dT/dt = −(T − T_a)/τ$,   точное решение $T(t) = T_a + (T_0 − T_a)e^{−t/τ}$.

```fortran
program euler_relax
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: ta = 2.0_dp, tau = 10.0_dp, t0 = 12.0_dp   ! °C, сутки, °C
  real(dp) :: dt, t, temp
  integer :: n, nsteps
  dt = 2.0_dp                          ! шаг, сутки
  nsteps = 15
  temp = t0
  print '(A)', '  t, сут   Эйлер    точное'
  do n = 0, nsteps
    t = n * dt
    print '(F8.1, 2F9.3)', t, temp, ta + (t0 - ta) * exp(-t / tau)
    temp = temp + dt * (-(temp - ta) / tau)
  end do
end program euler_relax
```

Попробуйте шаг `dt = 25` (больше $2τ$): решение начнёт «раскачиваться» и уйдёт в бесконечность. Это **неустойчивость** явной схемы: для этого уравнения метод Эйлера устойчив только при $Δt < 2τ$.

## Системы уравнений: инерционные колебания

Если в океане после прекращения ветра течение предоставлено само себе, то без трения и градиентов давления на него действует только сила Кориолиса:

$du/dt = f v$,   $dv/dt = −f u$.

Решение — вращение вектора скорости по часовой стрелке (в северном полушарии) с **инерционным периодом** $2π/f$. Модуль скорости $√(u² + v²)$ сохраняется.

Систему удобно записать для вектора $y = (u, v)$. Фортран прекрасно работает с массивами, поэтому функция правой части возвращает массив:

```fortran
program inertial_euler_rk4
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp)
  real(dp) :: f, dt, ye(2), yr(2), k1(2), k2(2), k3(2), k4(2)
  integer :: n, nsteps
  f = 2.0_dp * 7.2921e-5_dp * sin(60.0_dp * pi / 180)
  dt = 1800.0_dp                      ! 30 минут
  nsteps = 96                         ! двое суток
  ye = [0.5_dp, 0.0_dp]               ! u, v — м/с
  yr = ye
  print '(A)', '#  t, ч    u_эйлер  v_эйлер  u_РК4   v_РК4   |V|эйлер |V|РК4'
  do n = 0, nsteps
    if (mod(n, 4) == 0) print '(F8.1, 6F9.4)', n * dt / 3600, ye, yr, norm2(ye), norm2(yr)
    ! Эйлер
    ye = ye + dt * rhs(ye)
    ! Рунге–Кутта 4-го порядка
    k1 = rhs(yr)
    k2 = rhs(yr + dt / 2 * k1)
    k3 = rhs(yr + dt / 2 * k2)
    k4 = rhs(yr + dt * k3)
    yr = yr + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
  end do
contains
  pure function rhs(y) result(dy)
    real(dp), intent(in) :: y(2)
    real(dp) :: dy(2)
    dy(1) = f * y(2)
    dy(2) = -f * y(1)
  end function rhs
end program inertial_euler_rk4
```

Постройте график (📈): X = столбец 2 (u), Y = столбец 3 (v) — по Эйлеру получится раскручивающаяся **спираль**: метод Эйлера для колебаний неустойчив, энергия растёт на каждом шаге. Теперь X = 4, Y = 5 — метод Рунге–Кутты 4-го порядка (РК4) рисует почти идеальную окружность.

## Метод Рунге–Кутты 4-го порядка

$k_1 = f(t_n, y_n)$
$k_2 = f(t_n + Δt/2, y_n + Δt·k_1/2)$
$k_3 = f(t_n + Δt/2, y_n + Δt·k_2/2)$
$k_4 = f(t_n + Δt, y_n + Δt·k_3)$
$y_{n+1} = y_n + Δt·(k_1 + 2k_2 + 2k_3 + k_4)/6$

Погрешность — $O(Δt⁴)$: уменьшили шаг вдвое — ошибка упала в 16 раз.

~~~task
title: Метод Эйлера
---
Решите методом Эйлера уравнение $dy/dt = −k·y$, $y(0) = y_0$. Программа читает $y_0$, $k$, шаг $Δt$ и число шагов $n$ и печатает **одно** число — $y$ после $n$ шагов.
@starter
program euler_decay
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: y, k, dt
  integer :: n, i

  read(*,*) y, k, dt, n

end program euler_decay
@solution
program euler_decay
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: y, k, dt
  integer :: n, i
  read(*,*) y, k, dt, n
  do i = 1, n
    y = y + dt * (-k * y)
  end do
  print *, y
end program euler_decay
@test
@stdin
10 0.5 0.1 20
@expect
3.584859
@test
@stdin
1 1 0.5 4
@expect
0.0625
@test неустойчивость
@stdin
1 1 3 5
@expect
-32
~~~

~~~task
title: Инерционные колебания (РК4)
---
Решите систему $du/dt = fv$, $dv/dt = −fu$ методом **Рунге–Кутты 4-го порядка**. Программа читает широту $φ$ (градусы), начальные $u_0$, $v_0$ (м/с), шаг $Δt$ (с) и число шагов $n$. Выведите $u$ и $v$ после $n$ шагов.

$f = 2Ω sin φ$, $Ω = 7.2921·10^-5$ рад/с.

*Проверка:* точное решение $u = u_0 cos ft + v_0 sin ft$, $v = −u_0 sin ft + v_0 cos ft$. Метод Эйлера тесты не пройдёт!
@starter
program inertial_rk4
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp), omega = 7.2921e-5_dp
  real(dp) :: lat, f, dt, y(2)
  integer :: n, i

  read(*,*) lat, y(1), y(2), dt, n
  f = 2 * omega * sin(lat * pi / 180)

contains

  pure function rhs(y) result(dy)
    real(dp), intent(in) :: y(2)
    real(dp) :: dy(2)
    dy(1) = f * y(2)
    dy(2) = -f * y(1)
  end function rhs

end program inertial_rk4
@solution
program inertial_rk4
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: pi = 4.0_dp * atan(1.0_dp), omega = 7.2921e-5_dp
  real(dp) :: lat, f, dt, y(2), k1(2), k2(2), k3(2), k4(2)
  integer :: n, i
  read(*,*) lat, y(1), y(2), dt, n
  f = 2 * omega * sin(lat * pi / 180)
  do i = 1, n
    k1 = rhs(y)
    k2 = rhs(y + dt / 2 * k1)
    k3 = rhs(y + dt / 2 * k2)
    k4 = rhs(y + dt * k3)
    y = y + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
  end do
  print *, y
contains
  pure function rhs(y) result(dy)
    real(dp), intent(in) :: y(2)
    real(dp) :: dy(2)
    dy(1) = f * y(2)
    dy(2) = -f * y(1)
  end function rhs
end program inertial_rk4
@test сутки на 60° с.ш.
@stdin
60 0.5 0.0 600 144
@expect
-0.04146 0.49828
@test
@stdin
45 0.0 0.3 300 100
@expect
0.01434 -0.29966
@test южное полушарие
@stdin
-30 0.2 0.1 900 48
@expect
-0.199133 -0.101715
~~~
