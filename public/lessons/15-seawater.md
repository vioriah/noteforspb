# 15. Свойства морской воды

В этом уроке программируем стандартные океанологические формулы. Здесь особенно важны **двойная точность** и **проверочные значения** (*check values*): авторы формул публикуют контрольные ответы, по которым можно проверить свою реализацию.

## Плотность: уравнение состояния EOS-80

Международное уравнение состояния морской воды EOS-80 (UNESCO, 1981) для атмосферного давления ($p = 0$) записывается так. Плотность чистой воды (стандартная средняя океаническая вода, SMOW):

$ρ_w = 999.842594 + 6.793952·10^-2 T − 9.095290·10^-3 T² + 1.001685·10^-4 T³ − 1.120083·10^-6 T⁴ + 6.536332·10^-9 T⁵$

Плотность морской воды:

$ρ(S, T, 0) = ρ_w + S·(0.824493 − 4.0899·10^-3 T + 7.6438·10^-5 T² − 8.2467·10^-7 T³ + 5.3875·10^-9 T⁴)$
$  + S^{3/2}·(−5.72466·10^-3 + 1.0227·10^-4 T − 1.6546·10^-6 T²) + 4.8314·10^-4 S²$

Здесь $T$ — температура (°C, шкала IPTS-68), $S$ — практическая солёность. В океанологии часто используют **условную плотность** $σ_t = ρ(S, T, 0) − 1000$.

Полиномы удобно вычислять по **схеме Горнера**: $a + bT + cT² + dT³ = a + T(b + T(c + Td))$. Получается меньше умножений и меньше ошибок округления.

```fortran
module seawater
  implicit none
  integer, parameter :: dp = kind(1.0d0)
contains
  ! Плотность морской воды при p = 0 по EOS-80 (UNESCO 1981), кг/м3
  pure function rho_eos80(s, t) result(rho)
    real(dp), intent(in) :: s, t
    real(dp) :: rho, rhow
    rhow = 999.842594_dp + t*(6.793952e-2_dp + t*(-9.095290e-3_dp + t*(1.001685e-4_dp &
           + t*(-1.120083e-6_dp + t*6.536332e-9_dp))))
    rho = rhow + s*(0.824493_dp + t*(-4.0899e-3_dp + t*(7.6438e-5_dp + t*(-8.2467e-7_dp + t*5.3875e-9_dp)))) &
          + s*sqrt(s)*(-5.72466e-3_dp + t*(1.0227e-4_dp - t*1.6546e-6_dp)) &
          + 4.8314e-4_dp*s*s
  end function rho_eos80

  ! Скорость звука по формуле Маккензи (Mackenzie, 1981), м/с; d — глубина, м
  pure function sound_mackenzie(t, s, d) result(c)
    real(dp), intent(in) :: t, s, d
    real(dp) :: c
    c = 1448.96_dp + 4.591_dp*t - 5.304e-2_dp*t**2 + 2.374e-4_dp*t**3 &
        + 1.340_dp*(s - 35.0_dp) + 1.630e-2_dp*d + 1.675e-7_dp*d**2 &
        - 1.025e-2_dp*t*(s - 35.0_dp) - 7.139e-13_dp*t*d**3
  end function sound_mackenzie
end module seawater
```

Проверим реализацию по контрольным значениям UNESCO: $ρ(0, 5, 0) = 999.96675$, $ρ(35, 5, 0) = 1027.67547$, $ρ(35, 25, 0) = 1023.34306$, а для формулы Маккензи — $c(25 °C, 35, 1000 м) = 1550.744$ м/с.

```fortran
program check_values
  use seawater
  implicit none
  print '(A, F12.5, A)', 'rho(0,5)   = ', rho_eos80(0.0_dp, 5.0_dp),   '   (999.96675)'
  print '(A, F12.5, A)', 'rho(35,5)  = ', rho_eos80(35.0_dp, 5.0_dp),  '  (1027.67547)'
  print '(A, F12.5, A)', 'rho(35,25) = ', rho_eos80(35.0_dp, 25.0_dp), '  (1023.34306)'
  print '(A, F12.3, A)', 'c(25,35,1000) = ', sound_mackenzie(25.0_dp, 35.0_dp, 1000.0_dp), '  (1550.744)'
end program check_values
```

### Диаграмма: как σt зависит от T и S

```fortran
program sigma_table
  use seawater
  implicit none
  integer :: i, j
  real(dp) :: t
  write(*,'(A)', advance='no') '  T\S '
  write(*,'(6F8.1)') (30.0_dp + j, j = 0, 10, 2)
  do i = 0, 6
    t = -2.0_dp + 4.0_dp * i
    write(*,'(F6.1)', advance='no') t
    write(*,'(6F8.3)') (rho_eos80(30.0_dp + j, t) - 1000.0_dp, j = 0, 10, 2)
  end do
end program sigma_table
```

`advance='no'` — следующий `write` продолжит ту же строку. Видно, что при низких температурах плотность почти не зависит от $T$ и определяется солёностью. Поэтому в полярных морях стратификацию определяет солёность.

### Профиль скорости звука

```fortran
program sound_profile
  use seawater
  implicit none
  ! условный тропический профиль температуры
  real(dp) :: z(10) = [0., 50., 100., 200., 400., 700., 1000., 1500., 2500., 4000.]
  real(dp) :: t(10) = [27., 26., 20., 13., 8., 5.5, 4.5, 3.5, 2.5, 1.5]
  integer :: k, kmin
  real(dp) :: c(10)
  do k = 1, 10
    c(k) = sound_mackenzie(t(k), 35.0_dp, z(k))
    print '(F8.0, F10.2)', z(k), c(k)
  end do
  kmin = minloc(c, 1)
  print *, '# Ось звукового канала около', z(kmin), 'м, c =', c(kmin)
end program sound_profile
```

Постройте график в режиме «вертикальный профиль»: минимум скорости звука на глубине порядка 1 км (в этом условном профиле — около 700 м) — это **подводный звуковой канал** (ПЗК, SOFAR). Звук в нём распространяется на тысячи километров. Минимум возникает потому, что выше скорость звука растёт с температурой, а ниже — с давлением.

~~~task
title: Условная плотность σt
---
Реализуйте функцию плотности по EOS-80 (формулы выше) и выведите $σ_t = ρ(S, T, 0) − 1000$ для введённых $S$ и $T$ (именно в таком порядке).
@starter
program sigma_t
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: s, t

  read(*,*) s, t
  print *, rho(s, t) - 1000.0_dp

contains

  pure function rho(s, t) result(r)
    real(dp), intent(in) :: s, t
    real(dp) :: r
    r = 1000.0_dp   ! TODO: EOS-80
  end function rho

end program sigma_t
@solution
program sigma_t
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: s, t
  read(*,*) s, t
  print *, rho(s, t) - 1000.0_dp
contains
  pure function rho(s, t) result(r)
    real(dp), intent(in) :: s, t
    real(dp) :: r, rhow
    rhow = 999.842594_dp + t*(6.793952e-2_dp + t*(-9.095290e-3_dp + t*(1.001685e-4_dp &
           + t*(-1.120083e-6_dp + t*6.536332e-9_dp))))
    r = rhow + s*(0.824493_dp + t*(-4.0899e-3_dp + t*(7.6438e-5_dp + t*(-8.2467e-7_dp + t*5.3875e-9_dp)))) &
        + s*sqrt(s)*(-5.72466e-3_dp + t*(1.0227e-4_dp - t*1.6546e-6_dp)) + 4.8314e-4_dp*s*s
  end function rho
end program sigma_t
@hint
Будьте внимательны со знаками и степенями десяти: `6.793952e-2_dp` = $6.793952·10^-2$. Проверьте себя по контрольным значениям из урока.
@hint
$S^{3/2}$ = `s*sqrt(s)`.
@test
@stdin
35 5
@expect
27.6755
@test
@stdin
35 25
@expect
23.3431
@test пресная вода, 4 °C
@stdin
0 4
@expect
-0.0250
@test Балтика
@stdin
7.0 12.0
@expect
4.9314
~~~

~~~task
title: Скорость звука
---
Реализуйте формулу Маккензи (1981) для скорости звука:

$c = 1448.96 + 4.591T − 5.304·10^-2 T² + 2.374·10^-4 T³ + 1.340(S − 35) + 1.630·10^-2 D + 1.675·10^-7 D² − 1.025·10^-2 T(S − 35) − 7.139·10^-13 T D³$

Программа читает $T$ (°C), $S$, $D$ (глубина, м) и печатает $c$ (м/с).
@starter
program sound
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: t, s, d

  read(*,*) t, s, d

end program sound
@solution
program sound
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: t, s, d
  read(*,*) t, s, d
  print *, 1448.96_dp + 4.591_dp*t - 5.304e-2_dp*t**2 + 2.374e-4_dp*t**3 &
        + 1.340_dp*(s - 35.0_dp) + 1.630e-2_dp*d + 1.675e-7_dp*d**2 &
        - 1.025e-2_dp*t*(s - 35.0_dp) - 7.139e-13_dp*t*d**3
end program sound
@test контрольное значение
@stdin
25 35 1000
@expect
1550.744
@test
@stdin
0 35 0
@expect
1448.960
@test
@stdin
4 34.9 1200
@expect
1486.157
@test
@stdin
20 18 50
@expect
1502.984
~~~

~~~task
title: Температура замерзания
---
Температура замерзания морской воды (UNESCO, 1983):

$T_f = −0.0575 S + 1.710523·10^-3 S^{3/2} − 2.154996·10^-4 S² − 7.53·10^-4 p$,

где $p$ — давление в децибарах. Прочитайте $S$ и $p$ и выведите $T_f$ (°C).
@starter
program freezing
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: s, p

  read(*,*) s, p

end program freezing
@solution
program freezing
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp) :: s, p
  read(*,*) s, p
  print *, -0.0575_dp*s + 1.710523e-3_dp*s*sqrt(s) - 2.154996e-4_dp*s**2 - 7.53e-4_dp*p
end program freezing
@test
@stdin
35 0
@expect
-1.9223
@test
@stdin
35 500
@expect
-2.2988
@test
@stdin
0 0
@expect
0.0000
@test Белое море
@stdin
26 0
@expect
-1.4139
~~~

~~~task
title: Частота Вяйсяля–Брента
---
Устойчивость стратификации характеризует квадрат **частоты плавучести** (Вяйсяля–Брента):

$N² = (g/ρ_0)·Δσ/Δz$,

где $z$ — глубина (положительная вниз), $g = 9.81$, $ρ_0 = 1025$ кг/м³.

Даны $n$ и $n$ строк `z σ` (глубины по возрастанию). Для каждого из $n − 1$ слоёв выведите строку: глубину середины слоя и $N²$ (с⁻²). В последней строке выведите глубину середины слоя с **максимальным** $N²$ и соответствующий период плавучести $2π/N$ в **минутах**.
@starter
program brunt
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: g = 9.81_dp, rho0 = 1025.0_dp
  real(dp), allocatable :: z(:), sig(:)
  integer :: n, i

  read(*,*) n
  allocate(z(n), sig(n))
  do i = 1, n
    read(*,*) z(i), sig(i)
  end do

end program brunt
@solution
program brunt
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), parameter :: g = 9.81_dp, rho0 = 1025.0_dp, pi = 4.0_dp * atan(1.0_dp)
  real(dp), allocatable :: z(:), sig(:), n2(:), zm(:)
  integer :: n, i, k
  read(*,*) n
  allocate(z(n), sig(n), n2(n-1), zm(n-1))
  do i = 1, n
    read(*,*) z(i), sig(i)
  end do
  do i = 1, n - 1
    zm(i) = (z(i) + z(i+1)) / 2
    n2(i) = g / rho0 * (sig(i+1) - sig(i)) / (z(i+1) - z(i))
    print '(F8.1, ES14.4)', zm(i), n2(i)
  end do
  k = maxloc(n2, 1)
  print '(F8.1, F10.2)', zm(k), 2 * pi / sqrt(n2(k)) / 60
end program brunt
@hint
Массивы середин слоёв и $N²$ имеют длину $n − 1$. Максимум — `maxloc(n2, 1)`.
@test
@stdin
5
0 25.10
10 25.12
20 25.60
30 26.40
50 26.70
@expect
5.0 1.914E-05
15.0 4.594E-04
25.0 7.657E-04
40.0 1.436E-04
25.0 3.78
@test
@stdin
3
0 10.0
100 11.0
200 11.5
@expect
50.0 9.571E-05
150.0 4.785E-05
50.0 10.70
~~~
