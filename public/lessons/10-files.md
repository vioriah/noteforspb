# 10. Работа с файлами

Реальные данные — профили CTD, ряды с мареографов, поля реанализа — хранятся в файлах. В этом уроке читаем и пишем **текстовые** файлы.

> **Файлы в этом блокноте.** Кнопка **📁 Файлы** сверху открывает файлы блокнота. При запуске программы они лежат в её рабочей папке. Файлы, которые программа *создала*, появляются под результатом: их можно посмотреть, скачать, построить по ним график или сохранить в блокнот.

В этом уроке уже есть файл с профилем температуры и солёности (условная летняя станция в Баренцевом море):

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

## Открыть, прочитать, закрыть

```f90
open(unit=10, file='ctd.txt', status='old', action='read')
read(10, *) a, b, c        ! так же, как read(*,*), но из устройства 10
close(10)
```

- `unit` — номер устройства, произвольное целое (не используйте 5 и 6: это клавиатура и экран). Современный вариант — `newunit=u`: компилятор сам выберет свободный номер и запишет его в переменную `u`.
- `status='old'` — файл должен существовать; `'replace'` — создать заново (старый будет стёрт); `'new'` — создать, ошибка, если уже есть.
- `action='read'` / `'write'` / `'readwrite'`.

## Чтение до конца файла: `iostat`

Обычно количество строк в файле неизвестно. Добавьте в `read` параметр `iostat=ios`: после чтения `ios` равен 0, если всё в порядке, **отрицателен** в конце файла и положителен при ошибке (например, буква вместо числа).

```fortran
program read_ctd
  implicit none
  integer :: u, ios, n
  real :: z, t, s
  open(newunit=u, file='ctd.txt', status='old', action='read')
  read(u, *)                       ! пустой read пропускает строку (заголовок)
  n = 0
  do
    read(u, *, iostat=ios) z, t, s
    if (ios /= 0) exit             ! конец файла или ошибка
    n = n + 1
    print '(F6.0, 2F8.2)', z, t, s
  end do
  close(u)
  print *, 'Прочитано строк:', n
end program read_ctd
```

Нажмите **📈 график** под результатом и включите «вертикальный профиль», чтобы увидеть профиль температуры.

## Чтение в массивы: два прохода

Чтобы сложить данные в `allocatable`-массивы, файл читают **дважды**: сначала считают строки, затем выделяют память, возвращаются в начало (`rewind`) и читают уже в массивы.

```fortran
program read_to_arrays
  implicit none
  real, allocatable :: z(:), t(:), s(:)
  integer :: u, ios, n, k
  open(newunit=u, file='ctd.txt', status='old', action='read')
  read(u, *)                        ! заголовок
  n = 0
  do
    read(u, *, iostat=ios)
    if (ios /= 0) exit
    n = n + 1
  end do
  allocate(z(n), t(n), s(n))
  rewind(u)                          ! в начало файла
  read(u, *)
  do k = 1, n
    read(u, *) z(k), t(k), s(k)
  end do
  close(u)
  print *, 'n =', n
  print *, 'T: от', minval(t), 'до', maxval(t)
  print *, 'Средняя солёность слоя 0–50 м:', sum(s, mask = z <= 50.0) / count(z <= 50.0)
end program read_to_arrays
```

## Запись в файл

```fortran
program write_file
  implicit none
  integer :: u, k
  real :: z
  open(newunit=u, file='pressure.txt', status='replace', action='write')
  write(u, '(A)') '# depth_m   p_dbar'
  do k = 0, 10
    z = 50.0 * k
    write(u, '(F8.1, F10.2)') z, 1025.0 * 9.81 * z / 1.0e4
  end do
  close(u)
  print *, 'Файл pressure.txt записан'
end program write_file
```

Под результатом появится файл `pressure.txt`: откройте его кнопкой «показать».

## Проверка ошибок открытия

```fortran
program open_check
  implicit none
  integer :: u, ios
  logical :: exists
  inquire(file='no_such_file.txt', exist=exists)
  print *, 'Файл существует?', exists
  open(newunit=u, file='no_such_file.txt', status='old', iostat=ios)
  if (ios /= 0) then
    print *, 'Не удалось открыть файл, код', ios
  end if
end program open_check
```

Без `iostat` программа при ошибке открытия аварийно завершится с сообщением `Cannot open file`.

~~~task
title: Среднее из файла
---
В файле `temp.txt` записаны температуры, по одной в строке. Их количество заранее неизвестно. Выведите количество значений и среднее.
@starter
program file_mean
  implicit none
  integer :: u, ios, n
  real :: t

  open(newunit=u, file='temp.txt', status='old', action='read')

  close(u)
end program file_mean
@solution
program file_mean
  implicit none
  integer :: u, ios, n
  real :: t, s
  open(newunit=u, file='temp.txt', status='old', action='read')
  n = 0
  s = 0.0
  do
    read(u, *, iostat=ios) t
    if (ios /= 0) exit
    n = n + 1
    s = s + t
  end do
  close(u)
  print *, n, s / n
end program file_mean
@hint
Бесконечный `do` + `read(u, *, iostat=ios) t` + `if (ios /= 0) exit`.
@test
@file temp.txt
4.5
4.7
4.6
@expect
3 4.6
@test
@file temp.txt
-1.2
-0.8
0.4
1.9
3.5
2.2
@expect
6 1.0
~~~

~~~task
title: Холодный промежуточный слой
---
В файле `ctd.txt` первая строка — заголовок, далее столбцы: глубина, температура, солёность. Выведите:

1. количество измерений;
2. минимальную температуру;
3. глубину, на которой она наблюдается;
4. среднюю солёность по всем измерениям.
@starter
program cil
  implicit none
  real, allocatable :: z(:), t(:), s(:)
  integer :: u, ios, n, k

  open(newunit=u, file='ctd.txt', status='old', action='read')

  close(u)
end program cil
@solution
program cil
  implicit none
  real, allocatable :: z(:), t(:), s(:)
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
  k = minloc(t, 1)
  print *, n, t(k), z(k), sum(s) / n
end program cil
@hint
Используйте схему «два прохода» из урока: посчитать строки → `allocate` → `rewind` → прочитать в массивы.
@test Чёрное море, лето
@file ctd.txt
depth temp sal
0 24.1 18.10
10 23.8 18.12
20 15.2 18.30
30 9.1 18.45
50 7.4 18.70
75 7.9 19.40
100 8.3 20.20
150 8.7 21.00
@expect
8 7.4 50 19.03375
@test
@file ctd.txt
depth temp sal
0 -1.2 32.0
25 -1.6 33.1
50 -1.8 34.0
100 0.5 34.6
@expect
4 -1.8 50 33.425
~~~

~~~task
title: Запись профиля плотности
---
Прочитайте `ctd.txt` (заголовок + столбцы глубина, температура, солёность) и запишите в **файл** `rho.txt` для каждого измерения глубину и плотность по линейному уравнению состояния

$ρ = ρ_0 [1 − α(T − T_0) + β(S − S_0)]$,

где $ρ_0 = 1027$ кг/м³, $α = 1.7·10^-4$ 1/°C, $β = 7.6·10^-4$ 1/епс, $T_0 = 10$ °C, $S_0 = 35$.

Формат строки файла: `(F7.1, F10.3)`. На экран можно ничего не выводить — проверяется файл.
@starter
program rho_file
  implicit none
  real :: z, t, s
  integer :: uin, uout, ios

  open(newunit=uin, file='ctd.txt', status='old', action='read')
  open(newunit=uout, file='rho.txt', status='replace', action='write')

  close(uin)
  close(uout)
end program rho_file
@solution
program rho_file
  implicit none
  real, parameter :: rho0 = 1027.0, alpha = 1.7e-4, beta = 7.6e-4, t0 = 10.0, s0 = 35.0
  real :: z, t, s
  integer :: uin, uout, ios
  open(newunit=uin, file='ctd.txt', status='old', action='read')
  open(newunit=uout, file='rho.txt', status='replace', action='write')
  read(uin, *)
  do
    read(uin, *, iostat=ios) z, t, s
    if (ios /= 0) exit
    write(uout, '(F7.1, F10.3)') z, rho0 * (1.0 - alpha * (t - t0) + beta * (s - s0))
  end do
  close(uin)
  close(uout)
end program rho_file
@hint
Можно читать и сразу писать построчно — массивы не нужны.
@test
@file ctd.txt
depth temp sal
0 10.0 35.0
10 5.0 34.5
50 2.0 34.9
@expectfile rho.txt
0.0 1027.000
10.0 1027.483
50.0 1028.319
@test
@file ctd.txt
depth temp sal
0 20.0 36.0
@expectfile rho.txt
0.0 1026.035
~~~
