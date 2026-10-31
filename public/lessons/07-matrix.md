# 7. Двумерные массивы и поля на сетке

Поле температуры поверхности океана, батиметрия, разрез «станция × горизонт» — всё это **двумерные массивы**.

```f90
real :: sst(ny, nx)          ! ny строк (широт), nx столбцов (долгот)
real :: section(0:5, 10)     ! границы можно задавать по каждому измерению
real, allocatable :: f(:,:)
allocate(f(ny, nx))
```

Элемент — `sst(i, j)`, строка — `sst(i, :)`, столбец — `sst(:, j)`, подматрица — `sst(2:4, 1:3)`.

## Порядок хранения: по столбцам

В памяти Фортран хранит массив **по столбцам** (*column-major*): сначала `a(1,1), a(2,1), a(3,1)`, затем `a(1,2), …` (в C и Python/NumPy наоборот). Поэтому во вложенных циклах **внутренний** цикл должен идти по **первому** индексу — так процессор читает память подряд, и программа работает быстрее:

```f90
do j = 1, nx          ! внешний — по второму индексу
  do i = 1, ny        ! внутренний — по первому
    f(i, j) = ...
  end do
end do
```

## Ввод и вывод по строкам

Матрицу удобно читать и печатать **построчно** с помощью неявного цикла:

```fortran
program matrix_io
  implicit none
  integer, parameter :: ny = 3, nx = 4
  real :: t(ny, nx)
  integer :: i, j
  do i = 1, ny
    read(*,*) (t(i, j), j = 1, nx)          ! одна строка входа = одна строка матрицы
  end do
  print *, 'Форма массива:', shape(t)
  do i = 1, ny
    write(*,'(4F7.2)') t(i, :)               ! вывод строки
  end do
  print *, 'Порядок в памяти (read(*,*) t читал бы так же):'
  print '(12F6.1)', t
end program matrix_io
```
```stdin
1 2 3 4
5 6 7 8
9 10 11 12
```

Обратите внимание на последнюю строку: если вывести (или прочитать) массив целиком, элементы идут **по столбцам**.

## Функции с аргументом `dim`

`sum`, `maxval`, `minval`, `count`, `product` принимают необязательный аргумент `dim`: по какому измерению сворачивать.

- `sum(a, dim=1)` — суммы по столбцам (результат длины `nx`);
- `sum(a, dim=2)` — суммы по строкам (длины `ny`);
- `maxloc(a)` — массив из двух индексов `[i, j]` максимума.

```fortran
program zonal_mean
  implicit none
  ! условное поле ТПО: 4 широты × 5 долгот, °C; -99 — суша
  real :: sst(4, 5)
  logical :: sea(4, 5)
  integer :: i, loc(2)
  sst = reshape([ 26.1, 22.3, 15.2, 6.1,  &
                  26.8, 22.9, 16.0, 7.4,  &
                 -99.0, 23.5, 16.8, 8.2,  &
                  27.5, 24.0, 17.1, 8.0,  &
                  27.9, 24.2, 17.5, -99.0 ], [4, 5])   ! reshape заполняет по столбцам!
  sea = sst > -90.0
  do i = 1, 4
    print '(A, I0, A, F6.2)', 'Широта №', i, ': зональное среднее ', &
          sum(sst(i, :), mask = sea(i, :)) / count(sea(i, :))
  end do
  loc = maxloc(sst, mask = sea)
  print *, 'Максимум', maxval(sst, mask = sea), 'в узле', loc
  print *, 'Число узлов суши:', count(.not. sea)
end program zonal_mean
```

## Матричные операции

`matmul(a, b)` — матричное произведение, `transpose(a)` — транспонирование, `dot_product(x, y)` — скалярное произведение векторов. **Не путайте** с `a * b` — это *поэлементное* произведение!

```fortran
program matmul_demo
  implicit none
  real :: r(2, 2), v(2), angle
  angle = 30.0 * 3.14159265 / 180.0
  ! матрица поворота — пригодится для перехода к осям «вдоль/поперёк берега»
  r = reshape([cos(angle), -sin(angle), sin(angle), cos(angle)], [2, 2])
  v = [1.0, 0.0]                      ! вектор течения: 1 м/с на восток
  print *, 'Повёрнутый вектор:', matmul(r, v)
  print *, 'R * R^T (должна быть единичная):'
  print '(2F8.4)', transpose(matmul(r, transpose(r)))
end program matmul_demo
```

~~~task
title: Зональные средние
---
В первой строке заданы размеры поля $ny$ и $nx$, далее — $ny$ строк по $nx$ чисел. Для каждой строки (широты) выведите среднее значение — каждое на отдельной строке.
@starter
program zonal
  implicit none
  real, allocatable :: f(:,:)
  integer :: ny, nx, i, j

  read(*,*) ny, nx
  allocate(f(ny, nx))

end program zonal
@solution
program zonal
  implicit none
  real, allocatable :: f(:,:)
  integer :: ny, nx, i, j
  read(*,*) ny, nx
  allocate(f(ny, nx))
  do i = 1, ny
    read(*,*) (f(i, j), j = 1, nx)
  end do
  do i = 1, ny
    print *, sum(f(i, :)) / nx
  end do
end program zonal
@hint
Читайте построчно: `read(*,*) (f(i, j), j = 1, nx)` внутри цикла по `i`. Среднее строки — `sum(f(i, :)) / nx`.
@test
@stdin
2 3
1 2 3
4 5 9
@expect
2.0
6.0
@test
@stdin
3 4
26.1 26.8 27.5 27.9
15.2 16.0 16.8 17.1
6.1 7.4 8.2 8.0
@expect
27.075
16.275
7.425
~~~

~~~task
title: Где максимум?
---
Прочитайте поле $ny × nx$ (как в предыдущей задаче) и выведите максимальное значение, затем номер строки и номер столбца, где оно находится. Если максимумов несколько, выведите первый **по порядку хранения** — так работает `maxloc`.
@starter
program field_max
  implicit none
  real, allocatable :: f(:,:)
  integer :: ny, nx, i, j

  read(*,*) ny, nx
  allocate(f(ny, nx))
  do i = 1, ny
    read(*,*) (f(i, j), j = 1, nx)
  end do

end program field_max
@solution
program field_max
  implicit none
  real, allocatable :: f(:,:)
  integer :: ny, nx, i, j, loc(2)
  read(*,*) ny, nx
  allocate(f(ny, nx))
  do i = 1, ny
    read(*,*) (f(i, j), j = 1, nx)
  end do
  loc = maxloc(f)
  print *, maxval(f), loc(1), loc(2)
end program field_max
@test
@stdin
2 3
1 7 3
4 5 6
@expect
7 1 2
@test
@stdin
3 3
0.5 0.1 0.2
0.3 0.9 0.4
0.8 0.6 0.7
@expect
0.9 2 2
@test
@stdin
1 4
-3 -1 -2 -5
@expect
-1 1 2
~~~

~~~task
title: Сглаживание поля
---
Сгладьте поле $ny × nx$: в каждом **внутреннем** узле новое значение равно среднему этого узла и четырёх соседей (сверху, снизу, слева, справа). Граничные узлы не меняются. Все новые значения вычисляйте по **старому** полю (нужна копия!).

Выведите сглаженное поле построчно, формат каждого числа — `F7.2`.
@starter
program smooth
  implicit none
  real, allocatable :: f(:,:), g(:,:)
  integer :: ny, nx, i, j

  read(*,*) ny, nx
  allocate(f(ny, nx), g(ny, nx))
  do i = 1, ny
    read(*,*) (f(i, j), j = 1, nx)
  end do

end program smooth
@solution
program smooth
  implicit none
  real, allocatable :: f(:,:), g(:,:)
  integer :: ny, nx, i, j
  read(*,*) ny, nx
  allocate(f(ny, nx), g(ny, nx))
  do i = 1, ny
    read(*,*) (f(i, j), j = 1, nx)
  end do
  g = f
  do j = 2, nx - 1
    do i = 2, ny - 1
      g(i, j) = (f(i, j) + f(i-1, j) + f(i+1, j) + f(i, j-1) + f(i, j+1)) / 5.0
    end do
  end do
  do i = 1, ny
    write(*,'(*(F7.2))') g(i, :)
  end do
end program smooth
@hint
`g = f` копирует всё поле. Затем в двойном цикле по `i = 2 … ny−1`, `j = 2 … nx−1` пишите в `g`, а читайте из `f`.
@hint
Формат `'(*(F7.2))'` повторяет `F7.2` столько раз, сколько нужно.
@test
@stdin
3 3
0 0 0
0 10 0
0 0 0
@expect
0.00 0.00 0.00
0.00 2.00 0.00
0.00 0.00 0.00
@test
@stdin
3 4
1 2 3 4
5 6 7 8
9 10 11 12
@expect
1.00 2.00 3.00 4.00
5.00 6.00 7.00 8.00
9.00 10.00 11.00 12.00
@test
@stdin
4 4
5 5 5 5
5 0 10 5
5 20 0 5
5 5 5 5
@expect
5.00 5.00 5.00 5.00
5.00 8.00 4.00 5.00
5.00 6.00 8.00 5.00
5.00 5.00 5.00 5.00
~~~
