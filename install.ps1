#Requires -Version 5.1
<#
  dsh-cost-gauge-plus 一键安装脚本
  ------------------------------------------------
  推荐用法（复制整行到 PowerShell 回车，直接安装到 web profile）：

    irm https://raw.githubusercontent.com/wjingshan/dsh-cost-gauge-plus/main/install.ps1 | iex

  默认安装 **主分支**（`github:wjingshan/dsh-cost-gauge-plus`，省略 ref）。这样插件市场之后
  才能正常提示并执行「更新」——市场只对**省略 ref** 的写法做加速：它会先把分支 HEAD 解析成
  固定 commit 再安装。写成显式分支名（`#main`）或固定 tag，市场都会报「版本没有变化」。

  想指定版本 / 来源时，先下载脚本再带参数运行：

    irm https://raw.githubusercontent.com/wjingshan/dsh-cost-gauge-plus/main/install.ps1 -OutFile install-dsh-cost-gauge-plus.ps1
    .\install-dsh-cost-gauge-plus.ps1                            # 跟主分支（市场可自动更新）
    .\install-dsh-cost-gauge-plus.ps1 -Ref v1.5.4                # 锁 tag（市场不会自动更新）
    .\install-dsh-cost-gauge-plus.ps1 -Source .\dsh-cost-gauge-plus              # 本地目录（链接方式）
    .\install-dsh-cost-gauge-plus.ps1 -Source https://github.com/wjingshan/dsh-cost-gauge-plus/archive/refs/tags/v1.5.4.tar.gz

  说明：
    - 默认的 `github:` 写法由 pnpm 用 `git ls-remote` 解析分支，**需要本机有 git**；
      检测不到 git 时会自动回退到「最新 Release 的 tarball 直链」（那种装法市场不会提示更新）。
    - 需要 Node.js >= 20 与 DeepSeek Harness（带 dsh 命令；没有则自动用 npx）。
#>
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [string]$Ref = '',            # 留空 = 主分支（市场可自动更新）；填 tag（v1.5.4）等固定版本则市场不会自动更新
  [string]$Owner = 'wjingshan',
  [string]$Repo = 'dsh-cost-gauge-plus',
  [string]$Source = ''   # 可选：本地目录或任意安装源；留空则按 -Ref 用 github: 写法
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok([string]$m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Write-Warn([string]$m) { Write-Host "    [!]  $m" -ForegroundColor Yellow }
function Fail([string]$m)       { Write-Host "`n[x] $m" -ForegroundColor Red; exit 1 }

# 1) 定位 dsh 命令
Write-Step '检查 dsh 命令'
$dshCmd = Get-Command dsh -CommandType Application,ExternalScript -ErrorAction SilentlyContinue
if ($dshCmd) {
  Write-Ok "找到 dsh：$($dshCmd.Source)"
} else {
  Write-Warn '未找到全局 dsh 命令，将改用 npx --yes @deepseek-ai/dsh'
}

function Invoke-Dsh([string[]]$Args) {
  if ($dshCmd) {
    & dsh @Args
    if ($LASTEXITCODE -ne 0) { Fail "dsh $($Args -join ' ') 失败（exit $LASTEXITCODE）" }
  } else {
    & npx --yes @deepseek-ai/dsh @Args
    if ($LASTEXITCODE -ne 0) { Fail "npx @deepseek-ai/dsh $($Args -join ' ') 失败（exit $LASTEXITCODE）" }
  }
}

# 2) 解析安装来源
#    默认省略 ref：市场的加速层只对这种写法做处理——它先把分支 HEAD 解析成固定 commit 再安装，
#    所以之后每次更新都能拿到新 commit。写成 #main 等显式 ref 会被原样交给 pnpm，而 pnpm
#    不会重新解析锁文件里已有的同一 specifier，更新永远报「版本没有变化」。
Write-Step "解析安装来源（$Repo → profile '$Profile'）…"
if ($Source) {
  Write-Ok "使用指定来源：$Source"
} else {
  if (-not $Ref) { $Ref = 'main' }
  $hasGit = [bool](Get-Command git -CommandType Application -ErrorAction SilentlyContinue)
  if ($hasGit) {
    if ($Ref -eq 'main') {
      $Source = "github:$Owner/$Repo"       # 省略 ref：市场可自动加速更新
    } else {
      $Source = "github:$Owner/$Repo#$Ref"  # 带固定 ref：市场不会自动更新
    }
    Write-Ok "安装来源：$Source"
    if ($Ref -ne 'main') {
      Write-Warn "锁定 ref（$Ref）：插件市场无法自动更新这种安装——市场只对省略 ref 的写法做加速，带 ref 的会被原样交给 pnpm。想能自动更新请去掉 -Ref。"
    }
  } else {
    Write-Warn '未找到 git：github: 写法需要 git 解析分支，改用最新 Release 的 tarball 直链。'
    if ($Ref -notmatch '^v?\d') {
      $Ref = ''
      try {
        $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'dsh-cost-gauge-plus-installer' } -TimeoutSec 15
        if ($latest -and $latest.tag_name) { $Ref = [string]$latest.tag_name }
      } catch {
        Write-Warn '获取最新 Release 失败'
      }
      if (-not $Ref) {
        Write-Warn '回退到默认 v1.5.4'
        $Ref = 'v1.5.4'
      }
    }
    $Source = "https://github.com/$Owner/$Repo/archive/refs/tags/$Ref.tar.gz"
    Write-Ok "安装来源：$Source"
    Write-Warn 'tarball 装法：插件市场不会提示更新；需要更新时重新运行本脚本，或装 git 后不带 -Ref 重装。'
  }
}

Write-Step "安装 $Repo 到 profile '$Profile'（ref=$Ref）…"
Invoke-Dsh @('plugin', '--profile', $Profile, 'add', $Source)
Write-Ok "已安装并登记为 profile 插件层"

# 3) 重启提示
Write-Step '完成'
Write-Host ''
Write-Host '  下一步：重启 dsh web 使其生效：' -ForegroundColor White
Write-Host ''
Write-Host '      dsh web' -ForegroundColor Green
Write-Host ''
Write-Host '  重启并刷新页面后，界面左上角会出现「DeepSeek 花费」方形浮动窗。' -ForegroundColor DarkGray
Write-Host '  余额阈值可在浮动窗点齿轮修改；峰谷费率指针会在标准/翻倍间自动摆动。' -ForegroundColor DarkGray
