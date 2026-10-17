/* wasi-sdk's libc implements WASIp2 name lookup. Rust std's resolver on
 * this target is still unsupported; keep libc layouts on the C side.
 *
 * The wasm32-wasip1 sysroot has no BSD sockets (no netdb.h, no socket,
 * connect, bind, listen or getaddrinfo). On p1 the transport calls the WASI
 * `sock_*` functions directly: inbound sockets are listener fds the host
 * pre-opened, outbound sockets and name resolution come from the `supa_net`
 * host imports. Every entry point has the same signature on both targets;
 * negative results are WASI errno values. */
#include <errno.h>
#include <string.h>

#if defined(__wasip2__)
#include <netdb.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/tcp.h>
#include <poll.h>
#include <stdio.h>
#include <sys/socket.h>
#include <unistd.h>

int perry_wasi_resolve(const char *hostname, int family, void *ctx,
                      void (*push)(void *, int, const unsigned char *)) {
    struct addrinfo hints = {0}, *results = 0;
    hints.ai_family = family == 4 ? AF_INET : family == 6 ? AF_INET6 : AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    int error = getaddrinfo(hostname, 0, &hints, &results);
    if (error) return error;
    for (struct addrinfo *entry = results; entry; entry = entry->ai_next) {
        if (entry->ai_family == AF_INET)
            push(ctx, 4, (const unsigned char *)&((struct sockaddr_in *)entry->ai_addr)->sin_addr);
        else if (entry->ai_family == AF_INET6)
            push(ctx, 6, (const unsigned char *)&((struct sockaddr_in6 *)entry->ai_addr)->sin6_addr);
    }
    freeaddrinfo(results);
    return 0;
}

/* Keep libc's sockaddr and poll layouts private to this translation unit.
 * Negative results are WASI errno values; no JS memory crosses this boundary. */
int perry_wasi_socket_nonblock(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags < 0 || fcntl(fd, F_SETFL, flags | O_NONBLOCK) < 0) return -errno;
    return 0;
}

int perry_wasi_tcp_open(const char *host, unsigned short port, int listening,
                        int backlog, int reuse_port, int nodelay, int *pending) {
    struct addrinfo hints = {0}, *addresses = 0;
    char service[6];
    snprintf(service, sizeof(service), "%u", (unsigned)port);
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_flags = listening ? AI_NUMERICHOST : 0;
    if (getaddrinfo(host, service, &hints, &addresses)) return -EHOSTUNREACH;
    int result = -EAFNOSUPPORT;
    for (struct addrinfo *a = addresses; a; a = a->ai_next) {
        int fd = socket(a->ai_family, SOCK_STREAM, 0);
        if (fd < 0) { result = -errno; continue; }
        int one = 1;
        if (listening) setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
        if (reuse_port) {
#ifdef SO_REUSEPORT
            if (setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &one, sizeof(one)) < 0) {
                result = -errno; close(fd); continue;
            }
#else
            result = -ENOTSUP; close(fd); continue;
#endif
        }
        if (nodelay) setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
        int nb = perry_wasi_socket_nonblock(fd);
        if (nb < 0) { result = nb; close(fd); continue; }
        if (listening) {
            if (bind(fd, a->ai_addr, a->ai_addrlen) < 0 || listen(fd, backlog) < 0) {
                result = -errno; close(fd); continue;
            }
            *pending = 0;
        } else if (connect(fd, a->ai_addr, a->ai_addrlen) < 0) {
            if (errno != EINPROGRESS && errno != EALREADY && errno != EAGAIN) {
                result = -errno; close(fd); continue;
            }
            *pending = 1;
        } else *pending = 0;
        result = fd;
        break;
    }
    freeaddrinfo(addresses);
    return result;
}

int perry_wasi_socket_connect_ready(int fd) {
    struct pollfd p = {fd, POLLOUT, 0};
    if (poll(&p, 1, 0) < 0) return -errno;
    if (!p.revents) return 0;
    int error = 0;
    socklen_t len = sizeof(error);
    if (getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &len) < 0) return -errno;
    return error ? -error : 1;
}

int perry_wasi_socket_accept(int fd, int nodelay) {
    int accepted = accept(fd, 0, 0);
    if (accepted < 0) return -errno;
    int error = perry_wasi_socket_nonblock(accepted);
    if (error < 0) { close(accepted); return error; }
    if (nodelay) { int one = 1; setsockopt(accepted, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one)); }
    return accepted;
}

int perry_wasi_socket_read(int fd, unsigned char *bytes, unsigned len) {
    ssize_t n = recv(fd, bytes, len, 0);
    return n < 0 ? -errno : (int)n;
}

int perry_wasi_socket_write(int fd, const unsigned char *bytes, unsigned len) {
    ssize_t n = send(fd, bytes, len, 0);
    return n < 0 ? -errno : (int)n;
}

/* Block until one of `fds` is ready (kinds bit 0 read, bit 1 write) or
 * `timeout_ns` elapses. Returns the number of ready fds, or a negative errno. */
int perry_wasi_poll(const int *fds, const unsigned char *kinds, unsigned n,
                    unsigned long long timeout_ns) {
    struct pollfd set[128];
    if (n > 128) n = 128;
    for (unsigned i = 0; i < n; i++) {
        set[i].fd = fds[i];
        set[i].events = (kinds[i] & 1 ? POLLIN : 0) | (kinds[i] & 2 ? POLLOUT : 0);
        set[i].revents = 0;
    }
    unsigned long long ms = (timeout_ns + 999999ull) / 1000000ull;
    int r = poll(set, n, ms > 2147483647ull ? 2147483647 : (int)ms);
    return r < 0 ? -errno : r;
}

/* Signals reach a p1 guest through a host stream; p2 has none. */
int perry_wasi_signal_fd(void) { return -1; }
int perry_wasi_stream_read(int fd, unsigned char *bytes, unsigned len) {
    ssize_t n = read(fd, bytes, len);
    return n < 0 ? -errno : (int)n;
}

int perry_wasi_socket_shutdown(int fd) { return shutdown(fd, SHUT_WR) < 0 ? -errno : 0; }
int perry_wasi_socket_close(int fd) { return close(fd) < 0 ? -errno : 0; }

int perry_wasi_socket_address(int fd, int peer, char *text, unsigned cap, unsigned short *port) {
    struct sockaddr_storage storage;
    socklen_t len = sizeof(storage);
    if ((peer ? getpeername(fd, (struct sockaddr *)&storage, &len)
              : getsockname(fd, (struct sockaddr *)&storage, &len)) < 0) return -errno;
    const void *ip;
    if (storage.ss_family == AF_INET) {
        struct sockaddr_in *a = (struct sockaddr_in *)&storage;
        ip = &a->sin_addr; *port = ntohs(a->sin_port);
    } else if (storage.ss_family == AF_INET6) {
        struct sockaddr_in6 *a = (struct sockaddr_in6 *)&storage;
        ip = &a->sin6_addr; *port = ntohs(a->sin6_port);
    } else return -EAFNOSUPPORT;
    return inet_ntop(storage.ss_family, ip, text, cap) ? 0 : -errno;
}

#else /* !__wasip2__ */

#include <stdio.h>
#include <stdlib.h>
#include <wasi/api.h>

#define IMPORT(name) __attribute__((__import_module__("supa_net"), __import_name__(name)))
/* Only referenced by a program that networks, so wasm-ld drops the imports of
 * every other program. */
IMPORT("tcp_connect") __wasi_errno_t supa_tcp_connect(const char *addr, unsigned len,
                                                      int timeout_ms, __wasi_fd_t *fd);
IMPORT("sock_error") __wasi_errno_t supa_sock_error(__wasi_fd_t fd, unsigned *err, unsigned *elapsed);
IMPORT("resolve") __wasi_errno_t supa_resolve(const char *host, unsigned len, int family,
                                              __wasi_fd_t *fd);

#define MAX_LISTENERS 16
#define MAX_SUBS 129

/* Listener discovery. The host pre-opens listeners after the dirs and names
 * them in SUPA_LISTEN_FDS (comma separated fd numbers) and, optionally, their
 * bound addresses in SUPA_LISTEN_ADDRS (same order). Without the variable,
 * scan for open stream sockets (a wasmtime `-S tcplisten` listener; its rights
 * do not include sock_accept, so the file type is the only marker). The scan
 * runs before the guest opens any socket of its own. Each listen() claims the
 * next unclaimed listener in that order; the requested host and port do not
 * select one. */
static int listener_fds[MAX_LISTENERS];
static char listener_addrs[MAX_LISTENERS][64];
static int listener_count = -1, listener_next;

int perry_wasi_signal_fd(void);

static void discover_listeners(void) {
    listener_count = 0;
    const char *fds = getenv("SUPA_LISTEN_FDS");
    if (fds && *fds) {
        for (const char *c = fds; *c && listener_count < MAX_LISTENERS;) {
            char *end;
            long fd = strtol(c, &end, 10);
            if (end == c) break;
            listener_fds[listener_count++] = (int)fd;
            c = *end == ',' ? end + 1 : end;
        }
        const char *addrs = getenv("SUPA_LISTEN_ADDRS");
        for (int i = 0; addrs && *addrs && i < listener_count; i++) {
            const char *comma = strchr(addrs, ',');
            size_t len = comma ? (size_t)(comma - addrs) : strlen(addrs);
            if (len < sizeof(listener_addrs[i])) { memcpy(listener_addrs[i], addrs, len); listener_addrs[i][len] = 0; }
            addrs = comma ? comma + 1 : addrs + len;
        }
        return;
    }
    for (int fd = 3; fd < 64 && listener_count < MAX_LISTENERS; fd++) {
        __wasi_fdstat_t st;
        if (__wasi_fd_fdstat_get((__wasi_fd_t)fd, &st) != 0) {
            if (fd > 8) break; /* preopens are dense; tolerate a short gap */
            continue;
        }
        if (st.fs_filetype == __WASI_FILETYPE_SOCKET_STREAM && fd != perry_wasi_signal_fd())
            listener_fds[listener_count++] = fd;
    }
}

int perry_wasi_signal_fd(void) {
    const char *v = getenv("SUPA_SIGNAL_FD");
    return v && *v ? atoi(v) : -1;
}

/* The host's signal and resolver streams are not sockets for `sock_recv`. */
int perry_wasi_stream_read(int fd, unsigned char *bytes, unsigned len) {
    __wasi_iovec_t iov = {bytes, len};
    __wasi_size_t n;
    __wasi_errno_t e = __wasi_fd_read((__wasi_fd_t)fd, &iov, 1, &n);
    return e ? -(int)e : (int)n;
}

int perry_wasi_resolve(const char *hostname, int family, void *ctx,
                      void (*push)(void *, int, const unsigned char *)) {
    if (listener_count < 0) discover_listeners();
    __wasi_fd_t fd;
    __wasi_errno_t e = supa_resolve(hostname, (unsigned)strlen(hostname), family, &fd);
    if (e) return (int)e;
    unsigned char record[4096];
    unsigned have = 0;
    for (;;) {
        __wasi_iovec_t iov = {record + have, sizeof(record) - have};
        __wasi_size_t n;
        e = __wasi_fd_read(fd, &iov, 1, &n);
        if (e == __WASI_ERRNO_AGAIN) {
            __wasi_subscription_t sub = {0};
            __wasi_event_t ev;
            __wasi_size_t ne;
            sub.userdata = 1;
            sub.u.tag = __WASI_EVENTTYPE_FD_READ;
            sub.u.u.fd_read.file_descriptor = fd;
            if (__wasi_poll_oneoff(&sub, &ev, 1, &ne)) { e = __WASI_ERRNO_IO; break; }
            continue;
        }
        if (e) break;
        if (n == 0 || have + n >= sizeof(record)) { have += n; break; }
        have += n;
    }
    if (__wasi_fd_close(fd) && !e) e = 0;
    if (e) return (int)e;
    if (have == 0) return 3;
    if (record[0]) return record[0];
    for (unsigned at = 1; at + 17 <= have; at += 17)
        push(ctx, record[at], record + at + 1);
    return 0;
}

int perry_wasi_socket_nonblock(int fd) {
    __wasi_errno_t e = __wasi_fd_fdstat_set_flags((__wasi_fd_t)fd, __WASI_FDFLAGS_NONBLOCK);
    return e ? -(int)e : 0;
}

int perry_wasi_tcp_open(const char *host, unsigned short port, int listening,
                        int backlog, int reuse_port, int nodelay, int *pending) {
    (void)backlog; (void)reuse_port; (void)nodelay;
    if (listener_count < 0) discover_listeners();
    if (listening) {
        if (listener_next >= listener_count) return -EADDRNOTAVAIL;
        *pending = 0;
        return listener_fds[listener_next++];
    }
    char target[320];
    int len = strchr(host, ':') ? snprintf(target, sizeof(target), "[%s]:%u", host, (unsigned)port)
                                : snprintf(target, sizeof(target), "%s:%u", host, (unsigned)port);
    if (len <= 0 || (size_t)len >= sizeof(target)) return -EINVAL;
    __wasi_fd_t fd;
    __wasi_errno_t e = supa_tcp_connect(target, (unsigned)len, 0, &fd);
    if (e) return -(int)e;
    *pending = 1;
    return (int)fd;
}

int perry_wasi_socket_connect_ready(int fd) {
    unsigned err = 0, elapsed = 0;
    __wasi_errno_t e = supa_sock_error((__wasi_fd_t)fd, &err, &elapsed);
    if (e) return -(int)e;
    if (err == __WASI_ERRNO_INPROGRESS) return 0;
    return err ? -(int)err : 1;
}

int perry_wasi_socket_accept(int fd, int nodelay) {
    (void)nodelay;
    __wasi_fd_t accepted;
    __wasi_errno_t e = __wasi_sock_accept((__wasi_fd_t)fd, __WASI_FDFLAGS_NONBLOCK, &accepted);
    return e ? -(int)e : (int)accepted;
}

int perry_wasi_socket_read(int fd, unsigned char *bytes, unsigned len) {
    __wasi_iovec_t iov = {bytes, len};
    __wasi_size_t n;
    __wasi_roflags_t flags;
    __wasi_errno_t e = __wasi_sock_recv((__wasi_fd_t)fd, &iov, 1, 0, &n, &flags);
    return e ? -(int)e : (int)n;
}

int perry_wasi_socket_write(int fd, const unsigned char *bytes, unsigned len) {
    __wasi_ciovec_t iov = {bytes, len};
    __wasi_size_t n;
    __wasi_errno_t e = __wasi_sock_send((__wasi_fd_t)fd, &iov, 1, 0, &n);
    return e ? -(int)e : (int)n;
}

int perry_wasi_socket_shutdown(int fd) {
    __wasi_errno_t e = __wasi_sock_shutdown((__wasi_fd_t)fd, __WASI_SDFLAGS_WR);
    return e ? -(int)e : 0;
}

int perry_wasi_socket_close(int fd) {
    __wasi_errno_t e = __wasi_fd_close((__wasi_fd_t)fd);
    return e ? -(int)e : 0;
}

/* WASI has no getsockname/getpeername: only a listener whose address the host
 * announced in SUPA_LISTEN_ADDRS has one; the caller falls back to the address
 * it asked for. */
int perry_wasi_socket_address(int fd, int peer, char *text, unsigned cap, unsigned short *port) {
    if (peer || listener_count <= 0) return -ENOTSUP;
    for (int i = 0; i < listener_count; i++) {
        if (listener_fds[i] != fd || !listener_addrs[i][0]) continue;
        const char *addr = listener_addrs[i];
        const char *colon = strrchr(addr, ':');
        if (!colon) return -EINVAL;
        size_t len = (size_t)(colon - addr);
        if (len >= 2 && addr[0] == '[' && addr[len - 1] == ']') { addr++; len -= 2; }
        if (len + 1 > cap) return -EINVAL;
        memcpy(text, addr, len);
        text[len] = 0;
        *port = (unsigned short)atoi(colon + 1);
        return 0;
    }
    return -ENOTSUP;
}

/* Block until one of `fds` is ready (kinds bit 0 read, bit 1 write) or
 * `timeout_ns` elapses. Returns the number of ready fds, or a negative errno.
 * One `poll_oneoff` carries every subscription plus a relative monotonic
 * clock, so an idle guest sleeps in the host instead of spinning. */
int perry_wasi_poll(const int *fds, const unsigned char *kinds, unsigned n,
                    unsigned long long timeout_ns) {
    __wasi_subscription_t subs[MAX_SUBS];
    __wasi_event_t events[MAX_SUBS];
    unsigned count = 0;
    memset(subs, 0, sizeof(subs));
    subs[count].userdata = 0;
    subs[count].u.tag = __WASI_EVENTTYPE_CLOCK;
    subs[count].u.u.clock.id = __WASI_CLOCKID_MONOTONIC;
    subs[count].u.u.clock.timeout = timeout_ns;
    subs[count].u.u.clock.precision = 1000000;
    subs[count].u.u.clock.flags = 0;
    count++;
    for (unsigned i = 0; i < n && count + 2 <= MAX_SUBS; i++) {
        if (kinds[i] & 1) {
            subs[count].userdata = i + 1;
            subs[count].u.tag = __WASI_EVENTTYPE_FD_READ;
            subs[count].u.u.fd_read.file_descriptor = (__wasi_fd_t)fds[i];
            count++;
        }
        if (kinds[i] & 2) {
            subs[count].userdata = i + 1;
            subs[count].u.tag = __WASI_EVENTTYPE_FD_WRITE;
            subs[count].u.u.fd_write.file_descriptor = (__wasi_fd_t)fds[i];
            count++;
        }
    }
    __wasi_size_t ready = 0;
    __wasi_errno_t e = __wasi_poll_oneoff(subs, events, count, &ready);
    if (e) return -(int)e;
    int fd_events = 0;
    for (unsigned i = 0; i < ready; i++)
        if (events[i].type != __WASI_EVENTTYPE_CLOCK) fd_events++;
    return fd_events;
}

#endif /* __wasip2__ */
