# ECS 部署方案与运维说明

## 部署结论

- 地域：中国大陆 ECS。
- 使用者：仅笔记仓库所有者本人。
- 公网入口：`https://139.196.212.191:8001/`。
- TLS：无域名阶段使用包含公网 IP SAN 的自签名证书，浏览器首次访问需要手动信任。
- 认证：Nginx Basic Auth，用户名为 `notehub`。Basic Auth 位于 TLS 内，不会以明文在网络上传输。
- 应用：Node.js 22，由 systemd 托管，仅监听 `127.0.0.1:43110`。
- 笔记同步：本机创建无凭据快照后使用 rsync 上传，服务器不保存 NoteHub 远端凭据。

## 端口选择记录

部署时确认 ECS 本机防火墙处于关闭状态，Nginx 能正常监听 `35400`，但从公网连接该端口超时；对比测试表明已有的 `8000`、`8082` 以及空闲的 `8001` 网络链路正常。因此最终使用已放行且未占用的 `8001`，没有继续依赖未实际生效的 `35400-35436` 安全组范围。

初始密码只保存在服务器的 bcrypt 哈希文件 `/etc/nginx/.htpasswd-notehub` 中，不写入 Git 仓库。交付后应使用下文命令改成个人密码。

## 目录结构

```text
/opt/markdown-note-manager/
├── current -> releases/<UTC timestamp>
└── releases/

/srv/notehub/                         # NoteHub 只读运行快照
/etc/markdown-note-manager/notehub.env
/etc/systemd/system/markdown-note-manager.service
/etc/nginx/nginx.conf
/etc/nginx/conf.d/notehub.conf
/etc/nginx/ssl/notehub.crt
/etc/nginx/ssl/notehub.key
/etc/nginx/.htpasswd-notehub
```

## 为什么快照中保留 `.git`

应用的 Git 状态接口需要工作树元数据。部署脚本不会直接复制本地 `.git`，而是：

1. 从本地 Git 仓库的 `HEAD` 导出 NoteHub 子目录，避免带入同仓库中的其他历史笔记目录。
2. 在临时目录中创建一个没有 remote 的独立基线仓库。
3. 将当前 NoteHub 工作区覆盖到基线仓库。
4. 把这个无 remote、无 Token、无 SSH Key 的快照上传到 ECS。

这样服务器可以展示分支、已修改文件和未跟踪文件，但无法访问远端仓库。

## 本机部署

首次部署前确保服务器基础配置已经完成。之后在项目根目录执行：

```bash
NOTEHUB_SOURCE=/Users/redkun/note/MyNote/NoteHub \
DEPLOY_HOST=root@139.196.212.191 \
./deploy/ecs/deploy.sh
```

如果恢复了服务器专用 SSH 私钥，可以增加：

```bash
DEPLOY_IDENTITY_FILE="$HOME/.ssh/id_ed25519_aliyun" ./deploy/ecs/deploy.sh
```

脚本每次执行都会：

1. 在本机构建前后端。
2. 创建无凭据 NoteHub 快照。
3. 上传一个带时间戳的应用 release。
4. 使用原子符号链接切换 `current`。
5. 同步 `/srv/notehub`，安装生产依赖并重启服务。
6. 调用本机回环健康检查。

## 常用运维命令

```bash
systemctl status markdown-note-manager --no-pager
journalctl -u markdown-note-manager -n 100 --no-pager
systemctl restart markdown-note-manager

nginx -t
systemctl status nginx --no-pager
tail -n 100 /var/log/nginx/error.log

curl http://127.0.0.1:43110/api/health
ss -lntp | grep -E '8001|43110'
```

## 修改访问密码

在服务器上执行，密码不会写入 shell 命令历史：

```bash
htpasswd -B /etc/nginx/.htpasswd-notehub notehub
nginx -t && systemctl reload nginx
```

## 更新自签名证书

无域名阶段证书的 SAN 必须包含公网 IP：

```bash
openssl req -x509 -nodes -newkey rsa:3072 -sha256 -days 825 \
  -keyout /etc/nginx/ssl/notehub.key \
  -out /etc/nginx/ssl/notehub.crt \
  -subj '/CN=139.196.212.191' \
  -addext 'subjectAltName=IP:139.196.212.191'
chmod 600 /etc/nginx/ssl/notehub.key
nginx -t && systemctl reload nginx
```

## 安全边界

- 公网仅暴露 Nginx 的 8001；43110 仅回环监听。
- 系统 Nginx 主配置不包含默认 80 端口站点，避免开放端口范围内出现未认证入口。
- 自签名证书提供传输加密，但不提供公共 CA 身份担保。首次访问必须人工核对证书指纹。
- NoteHub 包含私密内容，不能取消 Basic Auth，也不能将笔记目录交给 Nginx 直接静态托管。
- `.aws`、`.agents`、`.codex`、`.codebuddy`、`.workbuddy` 等本机工具目录不进入服务器快照。
- `/srv/notehub` 中的内容由本地副本恢复；部署同步使用 `--delete`，不要在服务器直接编辑笔记。
- 获得域名并完成ICP备案后，应替换为受信任 CA 证书并改用标准 443 端口。

## 回滚

查看已有版本：

```bash
ls -1dt /opt/markdown-note-manager/releases/*
```

将 `current` 切回上一版本并重启：

```bash
ln -sfn /opt/markdown-note-manager/releases/<release-id> /opt/markdown-note-manager/current.next
mv -Tf /opt/markdown-note-manager/current.next /opt/markdown-note-manager/current
systemctl restart markdown-note-manager
```

NoteHub 快照以本地工作区为准，重新运行部署脚本即可恢复。
