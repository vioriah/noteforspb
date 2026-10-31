# Шпаргалка по Фортрану

## Каркас программы

```f90
program name
  use my_module              ! модули — до implicit none
  implicit none
  integer, parameter :: dp = kind(1.0d0)
  ! объявления
  ! операторы
contains
  ! внутренние процедуры
end program name
```

## Объявления

```f90
integer :: n = 0, i
real(dp) :: x, y(100), a(10, 20)
real(dp), allocatable :: f(:), g(:,:)
real(dp), parameter :: pi = 4*atan(1.0_dp)
logical :: ok = .true.
character(len=32) :: name
type(station) :: st
```

## Управление

```f90
if (a > 0 .and. b /= 0) then        ! == /= < <= > >=  .and. .or. .not.
  ...
else if (a < 0) then
  ...
else
  ...
end if

select case (k)                     ! integer / character / logical
case (1, 2);  ...
case (3:9);   ...
case default; ...
end select

do i = 1, n, step                   ! exit — выход, cycle — следующая итерация
end do
do while (err > eps)
end do
do                                  ! бесконечный + exit
  if (условие) exit
end do
```

## Массивы

| Выражение | Смысл |
|---|---|
| `a = 0` | всем элементам |
| `a(2:5)`, `a(::2)`, `a(n:1:-1)` | сечения |
| `m(i, :)`, `m(:, j)` | строка, столбец |
| `[1, 2, 3]`, `[(i**2, i=1,n)]` | конструкторы |
| `size`, `shape`, `lbound`, `ubound` | размеры |
| `sum`, `product`, `maxval`, `minval` (`dim=`, `mask=`) | редукции |
| `maxloc(a, 1)`, `minloc(a, 1)` | индекс экстремума |
| `count(mask)`, `any`, `all`, `pack(a, mask)` | по условию |
| `where (a < 0) a = 0` | условное присваивание |
| `matmul`, `transpose`, `dot_product`, `reshape` | линейная алгебра |
| `allocate(a(n))`, `deallocate(a)`, `allocated(a)` | динамическая память |

Порядок хранения — **по столбцам**: во вложенных циклах внутренний идёт по первому индексу.

## Процедуры

```f90
function f(x) result(y)
  real(dp), intent(in) :: x
  real(dp) :: y
  y = ...
end function f

subroutine s(a, b, res)
  real(dp), intent(in) :: a(:)       ! перенимаемая форма
  real(dp), intent(inout) :: b
  real(dp), intent(out) :: res
end subroutine s

call s(arr, val, r)
```

## Ввод-вывод

```f90
read(*,*) a, b                         ! с клавиатуры (stdin)
print *, a, b                          ! на экран, свободный формат
write(*,'(A, I5, F8.3, ES12.4)') 'x=', n, x, y
open(newunit=u, file='data.txt', status='old', action='read')
read(u, *, iostat=ios) z, t            ! ios < 0 — конец файла
open(newunit=u, file='out.txt', status='replace', action='write')
write(u, '(2F10.3)') z, t
close(u)
write(str, '(A,I3.3)') 'st', k         ! в строку
```

| Формат | Пример | Вывод |
|---|---|---|
| `I5`, `I0`, `I3.3` | 42 | `···42`, `42`, `042` |
| `F8.3`, `F0.2` | 3.14159 | `···3.142`, `3.14` |
| `ES12.4` | 1234.5 | `··1.2345E+03` |
| `A`, `A10` | 'abc' | `abc` |
| `2X`, `/`, `*(F7.2)` | | пробелы, новая строка, повторять |

## Встроенные функции

`abs sqrt exp log log10 sin cos tan asin acos atan atan2(y,x) sinh cosh tanh`
`int nint floor ceiling real(x,dp) mod modulo min max sign hypot`
`trim adjustl len len_trim index // (склейка)`
`huge tiny epsilon precision kind`
`random_number(x) cpu_time(t) date_and_time()`

## Частые ошибки

| Симптом | Причина |
|---|---|
| `has no IMPLICIT type` | переменная не объявлена или опечатка |
| результат `0` вместо дроби | целочисленное деление `1/2`; пишите `1.0/2` |
| `*****` в выводе | число не помещается в формат |
| `End of file` | данных меньше, чем `read` пытается прочитать |
| `Index … above upper bound` | выход за границы массива |
| `Cannot open file` | нет файла или неверное имя/путь |
| неожиданное значение между вызовами | инициализация в объявлении процедуры (`integer :: k = 0`) = `save` |
| `sin(30.0)` ≠ 0.5 | аргумент в радианах |
| потеря точности | используйте `real(dp)` и литералы `1.0_dp` |

## Компиляция на своём компьютере

```f90
gfortran -Wall -fcheck=all -g prog.f90 -o prog    ! отладка: предупреждения и проверки границ
gfortran -O2 prog.f90 -o prog                      ! быстрая версия
gfortran mod1.f90 mod2.f90 main.f90 -o prog        ! модули — раньше программы
./prog < input.txt > output.txt                    ! ввод/вывод из файлов
```

Установка: Linux — `sudo apt install gfortran`; macOS — `brew install gcc`; Windows — MSYS2 (`pacman -S mingw-w64-ucrt-x86_64-gcc-fortran`) или WSL. Удобные редакторы — VS Code с расширением *Modern Fortran*, Code::Blocks (есть сборка для Фортрана).
