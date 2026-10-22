import ipaddress

IPV4_PREFIX = 24
IPV6_PREFIX = 48


def shorten_network(address: str | None) -> str | None:
    """The network a client address belongs to (203.0.113.0/24), never the address itself.

    The audit log has to say from where something was done (SEC-B-10), and the site does not keep visitors'
    addresses (SEC-B-10 again): the network answers "from the office or from somewhere else" and no more.
    """
    if not address:
        return None
    try:
        parsed = ipaddress.ip_address(address)
    except ValueError:
        return None
    prefix = IPV4_PREFIX if parsed.version == 4 else IPV6_PREFIX
    return str(ipaddress.ip_network(f"{parsed}/{prefix}", strict=False))
