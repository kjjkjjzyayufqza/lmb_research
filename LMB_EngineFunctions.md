### vsac27_Release.exe 中与 LMB 读写相关的基础函数整理

本文件基于 IDA Pro（通过 MCP 接口）对 `vsac27_Release.exe` 的反编译结果，总结了当前已经确认的、与「读取二进制资源文件（包括 LMB）」直接相关的底层函数。  
这些函数本身并不知道「LMB 格式」的细节，但它们构成了 LMB 读取流程的 I/O 与解压基础设施，可与 `LMB分析.md` 中的格式结构对应起来理解。

---

### 文件系统与路径解析相关

- **`nu::FileSystem_x64::Mount`**（地址：`0x140056E20`，符号：`?Mount@FileSystem_x64@nu@@SA?AVResult@2@PEBD0@Z`）
  - **作用**：通过内部的 `FileSystem` 单例接口，将某个逻辑路径或卷标挂载到实际的文件系统位置。LMB 等资源文件所在的根目录，很可能是通过此函数或其调用链进行注册的。
  - **实现要点（根据反编译）**：
    - 调用内部的 `sub_140056DB0()` 获取文件系统管理对象。
    - 通过该对象 vtable 上偏移 `+8` 的虚函数，转发执行真正的挂载逻辑。
  - **与 LMB 的关系**：任何 `*.lmb` 所在的资源根路径，都需要先被挂载，之后其它函数才能解析出正确的绝对路径并打开文件。

- **`nu::FileSystem_x64::GetAbsolutePath`**（地址：`0x140056EB0`，符号：`?GetAbsolutePath@FileSystem_x64@nu@@SA?AVResult@2@AEAV?$FixedString@$0CAA@D@2@AEBV42@@Z`）
  - **作用**：将「虚拟路径 / 相对路径」转换为当前挂载表下的「绝对文件系统路径」。
  - **实现要点**：
    - 与 `Mount` 一样，调用 `sub_140056DB0()` 拿到文件系统对象。
    - 通过该对象 vtable 上偏移 `+24` 的虚函数，将输入的逻辑路径转换写入输出缓冲区。
  - **与 LMB 的关系**：当游戏逻辑使用类似「资源名或相对路径」访问 LMB 时，真正落到磁盘上的绝对路径字符串就是通过此函数计算出来的。

- **`nu::File_x64::Exists`**（地址：`0x14005C2B0`，符号：`?Exists@File_x64@nu@@SA_NPEBD@Z`）
  - **作用**：判断某个逻辑文件名对应的实际文件是否存在。
  - **实现要点**（关键逻辑简述）：
    - 对输入的 C 字符串做长度检查，超过内部 `FixedString` 限制（0x200）会抛出 `std::out_of_range`。
    - 调用 `sub_140058770` 将输入路径拷贝到一个临时缓冲区。
    - 调用 `nu::FileSystem_x64::GetAbsolutePath` 得到绝对路径 `pszPath`。
    - 返回表达式：`!Result && PathFileExistsA(pszPath)`，也就是「路径解析成功且 Windows API 判断文件存在」。
  - **与 LMB 的关系**：在读取某个 LMB 之前，游戏极有可能先调用该函数确认对应路径是否存在，从而实现「资源存在性检查」或回退逻辑。

---

### 文件打开与读写相关

- **`nu::FileBase::Open`**（地址：`0x14005C560`，符号：`?Open@FileBase@nu@@UEAA?AVResult@2@PEBD@Z`）
  - **作用**：`FileBase` 的虚函数入口，用于统一对派生文件类的打开行为。
  - **实现要点**：
    - 从 `*a1` 读取 vtable 指针，构造一个本地参数数组（访问权限等），然后通过 vtable 上偏移 `+16` 的虚函数调用真正的打开逻辑。
    - 函数返回 `a2`（Result 对象），实际错误码由被调用的具体实现设置。
  - **与 LMB 的关系**：高层逻辑通常只拿到一个 `FileBase` 接口指针，通过此虚函数打开底层 `File_x64` 等具体实现，用于随后的 LMB 读取。

- **`nu::File_x64::OpenAbsolutePath`**（地址：`0x14005BCE0`，符号：`?OpenAbsolutePath@File_x64@nu@@UEAA?AVResult@2@PEBDAEBUDesc@FileBase@2@@Z`）
  - **作用**：在 Windows 上使用 `CreateFileA` 按给定「绝对路径 + 打开参数描述（Desc）」打开一个文件句柄。
  - **实现要点（关键片段）**：
    - 如果路径参数为 `nullptr`，直接将 Result 设为错误码 `-268431359` 并返回。
    - 如果当前对象已有打开的句柄，会先调用 vtable 上偏移 `+40` 的虚函数关闭之。
    - 根据 `Desc` 中的标志计算访问掩码（读 / 写 / 读写）与共享模式：
      - 访问掩码最终传入 `CreateFileA` 的 `dwDesiredAccess`。
      - 共享模式根据 `Desc` 的枚举值映射为 `FILE_SHARE_READ / FILE_SHARE_WRITE / FILE_SHARE_READ | FILE_SHARE_WRITE` 等。
      - 创建方式枚举被转换为 `CREATE_NEW / CREATE_ALWAYS / OPEN_EXISTING / OPEN_ALWAYS / TRUNCATE_EXISTING` 等 Windows 常量。
    - 调用 `CreateFileA(a3, access, share, nullptr, disposition, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_SEQUENTIAL_SCAN, nullptr)`。
    - 如失败，则通过 `GetLastError` 取得错误码，调用 `FormatMessageA` 把错误文本输出到 `OutputDebugStringA`，并调用 `sub_14005BC10` 将错误码与 `Desc` 映射为内部 Result。
    - 如成功，则把内部标志位 `*(a1+20)` 置为 1，将 Result 设为 0（成功）。
  - **与 LMB 的关系**：当上层已经通过 `GetAbsolutePath` 计算出某个 `.lmb` 的实际路径后，真正执行磁盘打开的就是这个函数，是读取 LMB 二进制数据的入口。

- **`nu::File_x64::Read`**（地址：`0x14005BF60`，符号：`?Read@File_x64@nu@@QEAA_KPEAX_K@Z`）
  - **作用**：从已打开的文件句柄中读取指定数量的字节，支持循环读取直到完成或出错。
  - **实现要点**：
    - 若内部打开标志 `this->flag` 为 0，直接返回 0，表示未读任何数据。
    - 使用 `ReadFile` 循环读取：
      - 每次读取量 `v8` 不超过 `0xFFFFFFFF`，即 32bit 上限。
      - 将数据写入 `a2 + v7` 偏移位置。
      - 累积已读字节数 `v7`，如果本次未读满请求长度或总字节已达目标则返回总计字节数。
    - 若任意一次 `ReadFile` 调用失败，则整函数返回 0。
  - **与 LMB 的关系**：在实现 Kaitai 式的 `lmb_type` 解析时，对 header、各个 tag 的二进制读取基本都依赖此函数（或其包装），对应 `LMB分析.md` 中所有「读取 u4/f4 結構」的底层实现。

- **`nu::File_x64::Seek`**（地址：`0x14005BEE0`，符号：`?Seek@File_x64@nu@@QEAA?AVResult@2@_JW4SeekMode@FileBase@2@@Z`）
  - **作用**：调整当前文件指针位置（支持从文件头 / 当前 / 文件尾三个基准）。
  - **实现要点**：
    - 若文件尚未打开（内部标志为 0），Result 设为 `-268431357` 并返回。
    - 根据 `a4`（`FileBase::SeekMode` 枚举）转换为 WinAPI 的 `FILE_BEGIN / FILE_CURRENT / FILE_END`。
    - 调用 `SetFilePointerEx(handle, offset, &NewFilePointer, origin)`：
      - 成功则 Result = 0。
      - 失败则 Result = `-268431352`。
  - **与 LMB 的关系**：在解析 tag 时，如需跳过 padding 或根据 `data_len` 精确跳转到下一个 tag，都会通过 seek 重定位，相当于实现 Kaitai 中的「手动移动流位置」。

---

### 压缩数据解码相关

- **`nu::Deflate::Decompress`**（地址：`0x1402753D0`，符号：`?Decompress@Deflate@nu@@SA?AVResult@2@PEAXI0IAEAI@Z`）
  - **作用**：对一段使用 zlib/Deflate 算法压缩的内存数据进行解压，将结果大小写入调用方提供的输出参数。
  - **实现要点**：
    - 将输入缓冲区指针、长度和输出缓冲区、容量等参数封装到本地结构（`v11` ~ `v19`）中。
    - 调用 `sub_140273520(&v11, 47, "1.2.8")` 初始化 zlib 结构体，字符串 `"1.2.8"` 明确指示引擎使用的 zlib 版本。
    - 随后调用 `sub_1402736F0(&v11, 4, ...)` 实际执行解压流程。
    - 若内部成员 `v16` 与回调指针 `v18` 有效，则调用回调清理解压上下文。
    - 将最终解压出来的字节数写入 `*a6 = v15`。
    - 返回 Result（`*a1 = 0` 表示成功，具体错误码在更完整的调用链中设置）。
  - **与 LMB 的关系**：如果某些 LMB 或其外部容器（例如 LMD/XMD）在磁盘上存储为 Deflate 压缩数据，那么真正的解压逻辑就集中在此函数中；配合前面的 `Read` / `Seek`，可以重建「读取压缩块 → 解压 → 按 `LMB分析.md` 中的結構解析」的整体流程。

---

### 当前进度与后续工作方向

- 当前已经通过 IDA MCP 明确了以下几类函数的职责：
  - 文件系统挂载与路径解析：`FileSystem_x64::Mount`、`FileSystem_x64::GetAbsolutePath`。
  - 文件存在性检查：`File_x64::Exists`。
  - 文件打开与基础 I/O：`FileBase::Open`、`File_x64::OpenAbsolutePath`、`File_x64::Read`、`File_x64::Seek`。
  - 通用压缩解码：`Deflate::Decompress`（zlib 1.2.8）。
- 后续若要进一步对应到 `LMB分析.md` 中的高层語義（例如 `symbols` / `transforms` / `define_sprite` / `frame` 解析邏輯），需要在 IDA 中：
  - 追踪从资源管理或 UI/動畫系統出发的調用鏈，定位具體讀取 LMB 標頭與 tag 的函數。
  - 對應 Kaitai `lmb_type` 中的欄位讀取模式（例如連續讀取 `textureId`, `resourceId`, `numPadding`, `totalFileLen` 等），進一步標註這些函數的名稱與職責。


