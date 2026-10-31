# 6. Одномерные массивы

Ряд наблюдений — температура на горизонтах, среднемесячные значения, отсчёты мареографа — естественно хранить в **массиве**.

## Объявление и обращение к элементам

```f90
real :: t(12)               ! 12 элементов: t(1) … t(12)
real, dimension(12) :: s    ! то же самое, другая запись
real :: z(0:100)            ! индексы от 0 до 100
integer, parameter :: n = 5
real :: a(n)                ! размер — именованная константа
```

По умолчанию индексы начинаются с **1** (не с 0, как в Python и C). Обращение к элементу: `t(3)`.

## Конструктор массива и неявный цикл

```fortran
program constructor
  implicit none
  integer :: i
  real :: depth(6), temp(6), sq(5)
  depth = [0.0, 10.0, 20.0, 30.0, 50.0, 75.0]       ! или (/ 0.0, 10.0, ... /)
  temp  = [8.1, 8.0, 7.2, 4.5, 2.1, 1.3]
  sq = [(real(i)**2, i = 1, 5)]                     ! неявный цикл в конструкторе
  print *, 'depth:', depth
  print *, 'temp(3) =', temp(3)
  print *, 'sq:', sq
end program constructor
```

## Операции над массивами целиком

В современном Фортране арифметика и элементарные функции работают **поэлементно** над целыми массивами — отдельный цикл не нужен:

```fortran
program whole_array
  implicit none
  real :: t_c(5), t_k(5), t_f(5)
  t_c = [-1.5, 0.0, 4.0, 12.5, 25.0]
  t_k = t_c + 273.15            ! к каждому элементу
  t_f = t_c * 9.0 / 5.0 + 32.0
  print '(A, 5F8.2)', 'C:', t_c
  print '(A, 5F8.2)', 'K:', t_k
  print '(A, 5F8.2)', 'F:', t_f
  print '(A, 5F8.3)', 'sqrt(K):', sqrt(t_k)
end program whole_array
```

## Сечения (срезы)

| Запись | Что означает |
|---|---|
| `a(2:5)` | элементы со 2-го по 5-й |
| `a(:3)` | с первого по 3-й |
| `a(4:)` | с 4-го до конца |
| `a(1:9:2)` | 1, 3, 5, 7, 9 (шаг 2) |
| `a(n:1:-1)` | в обратном порядке |

## Встроенные функции для массивов

| Функция | Результат |
|---|---|
| `size(a)` | число элементов |
| `sum(a)`, `product(a)` | сумма, произведение |
| `maxval(a)`, `minval(a)` | максимум, минимум |
| `maxloc(a)`, `minloc(a)` | **индекс** максимума/минимума (массив из 1 элемента; `maxloc(a, 1)` — просто число) |
| `count(a > 0)` | сколько элементов удовлетворяют условию |
| `any(a < 0)`, `all(a < 0)` | есть ли хоть один / все ли |
| `sum(a, mask = a > 0)` | сумма только по элементам, где маска истинна |
| `pack(a, a > 0)` | новый массив из подходящих элементов |
| `dot_product(a, b)` | скалярное произведение |

```fortran
program array_functions
  implicit none
  ! среднемесячная температура поверхности, °C (условный пример)
  real :: sst(12) = [ -1.2, -1.5, -1.1, 0.3, 2.8, 6.4, 9.9, 10.8, 8.0, 4.6, 1.7, -0.4 ]
  integer :: imax
  print *, 'Средняя за год:', sum(sst) / size(sst)
  imax = maxloc(sst, 1)
  print *, 'Максимум', maxval(sst), 'в месяце №', imax
  print *, 'Месяцев с отрицательной T:', count(sst < 0.0)
  print *, 'Средняя по тёплым месяцам:', sum(sst, mask = sst > 0.0) / count(sst > 0.0)
  print *, 'Лето (июнь–август):', sst(6:8)
  print *, 'Положительные:', pack(sst, sst > 0.0)
end program array_functions
```

## `where` — условное присваивание массиву

```fortran
program where_demo
  implicit none
  real :: t(8) = [3.2, 3.1, -999.0, 2.9, 2.7, -999.0, 2.4, 2.2]
  logical :: good(8)
  good = t > -900.0
  print *, 'Пропусков:', count(.not. good)
  print *, 'Среднее по хорошим:', sum(t, mask = good) / count(good)
  where (.not. good) t = 0.0      ! заменяем пропуски
  print '(8F6.1)', t
end program where_demo
```

## Размещаемые (allocatable) массивы

Часто длина ряда заранее неизвестна: она записана в начале файла или вычисляется. Тогда массив объявляют **размещаемым** и выделяют под него память, когда размер станет известен:

```fortran
program allocatable_demo
  implicit none
  real, allocatable :: x(:)
  integer :: n, i
  read(*,*) n
  allocate(x(n))
  read(*,*) (x(i), i = 1, n)       ! или просто read(*,*) x
  print *, 'Прочитано', size(x), 'значений, среднее =', sum(x) / n
  deallocate(x)                     ! освобождаем память (в конце программы — необязательно)
end program allocatable_demo
```
```stdin
5
12.1 11.8 12.4
12.0 11.7
```

## Статистика ряда

Для ряда $x_1 … x_n$:

- среднее $x̄ = (1/n) Σ x_i$;
- несмещённая оценка стандартного отклонения $σ = √( Σ (x_i − x̄)² / (n − 1) )$;
- аномалии $x_i' = x_i − x̄$.

С операциями над массивами это записывается почти как формула: `sqrt(sum((x - mean)**2) / (n - 1))`.

~~~task
title: Статистика ряда
---
В первой строке задано $n ≥ 2$, далее — $n$ вещественных чисел. Выведите четыре числа: среднее, несмещённое стандартное отклонение, минимум, максимум.
@starter
program stats
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), allocatable :: x(:)
  integer :: n

  read(*,*) n
  allocate(x(n))
  read(*,*) x

end program stats
@solution
program stats
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  real(dp), allocatable :: x(:)
  real(dp) :: mean, sd
  integer :: n
  read(*,*) n
  allocate(x(n))
  read(*,*) x
  mean = sum(x) / n
  sd = sqrt(sum((x - mean)**2) / (n - 1))
  print *, mean, sd, minval(x), maxval(x)
end program stats
@test
@stdin
5
12.1 11.8 12.4 12.0 11.7
@expect
12.0 0.2739 11.7 12.4
@test
@stdin
4
-1.5 -1.0 0.5 2.0
@expect
0.0 1.5811 -1.5 2.0
@test
@stdin
2
10 20
@expect
15.0 7.0711 10.0 20.0
~~~

~~~task
title: Аномалии
---
Заданы $n$ и ряд из $n$ значений (например, среднегодовая температура). Выведите:

1. количество значений **выше** среднего;
2. номер элемента с наибольшей по модулю аномалией $|x_i − x̄|$;
3. саму аномалию $x_i − x̄$ (со знаком).
@starter
program anomalies
  implicit none
  real, allocatable :: x(:), a(:)
  integer :: n

  read(*,*) n
  allocate(x(n), a(n))
  read(*,*) x

end program anomalies
@solution
program anomalies
  implicit none
  real, allocatable :: x(:), a(:)
  integer :: n, k
  read(*,*) n
  allocate(x(n), a(n))
  read(*,*) x
  a = x - sum(x) / n
  k = maxloc(abs(a), 1)
  print *, count(a > 0.0), k, a(k)
end program anomalies
@hint
Массив аномалий: `a = x - mean`. Индекс наибольшей по модулю — `maxloc(abs(a), 1)`.
@test
@stdin
6
8.1 8.4 7.9 9.6 8.0 8.2
@expect
2 4 1.233
@test
@stdin
5
2 4 4 4 -6
@expect
4 5 -7.6
~~~

~~~task
title: Скользящее среднее
---
Сгладьте ряд скользящим средним с окном 3: $y_i = (x_{i−1} + x_i + x_{i+1}) / 3$ для $i = 2 … n−1$. Выведите $n − 2$ сглаженных значения.
@starter
program running_mean
  implicit none
  real, allocatable :: x(:)
  integer :: n, i

  read(*,*) n
  allocate(x(n))
  read(*,*) x

end program running_mean
@solution
program running_mean
  implicit none
  real, allocatable :: x(:)
  integer :: n, i
  read(*,*) n
  allocate(x(n))
  read(*,*) x
  do i = 2, n - 1
    print *, (x(i-1) + x(i) + x(i+1)) / 3.0
  end do
end program running_mean
@hint
Можно и без цикла: `(x(1:n-2) + x(2:n-1) + x(3:n)) / 3`.
@test
@stdin
5
1 2 3 4 5
@expect
2 3 4
@test
@stdin
6
3 0 3 0 3 0
@expect
2 1 2 1
@test
@stdin
3
10.5 11.0 13.0
@expect
11.5
~~~

~~~task
title: Медиана
---
Прочитайте $n$ и $n$ чисел. **Отсортируйте** их по возрастанию (любым методом, например «пузырьком») и выведите в одной строке отсортированный ряд, а в следующей — медиану. Если $n$ чётное, медиана равна среднему двух центральных элементов.
@starter
program median
  implicit none
  real, allocatable :: x(:)
  real :: tmp
  integer :: n, i, j

  read(*,*) n
  allocate(x(n))
  read(*,*) x

end program median
@solution
program median
  implicit none
  real, allocatable :: x(:)
  real :: tmp, med
  integer :: n, i, j
  read(*,*) n
  allocate(x(n))
  read(*,*) x
  do i = 1, n - 1
    do j = 1, n - i
      if (x(j) > x(j+1)) then
        tmp = x(j)
        x(j) = x(j+1)
        x(j+1) = tmp
      end if
    end do
  end do
  if (mod(n, 2) == 1) then
    med = x(n/2 + 1)
  else
    med = (x(n/2) + x(n/2 + 1)) / 2.0
  end if
  print *, x
  print *, med
end program median
@hint
Сортировка пузырьком: два вложенных цикла; если `x(j) > x(j+1)` — поменять их местами через временную переменную.
@test
@stdin
5
3 1 4 1 5
@expect
1 1 3 4 5
3
@test
@stdin
4
10.2 -3.5 7.0 0.5
@expect
-3.5 0.5 7.0 10.2
3.75
@test
@stdin
1
42
@expect
42
42
~~~
