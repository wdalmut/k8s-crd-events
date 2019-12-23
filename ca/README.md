# Development CA

## Install this CA (debian)

Copy your CA to dir `/usr/local/share/ca-certificates/`
Use command: `sudo cp ca.crt /usr/local/share/ca-certificates/ca.crt`
Update the CA store: `sudo update-ca-certificates`

## Remove this CA (debian)

Remove your CA.
Update the CA store: `sudo update-ca-certificates --fresh`
