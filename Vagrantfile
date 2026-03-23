# -*- mode: ruby -*-
# vi: set ft=ruby :

# Vagrantfile for documentation testing
# Single Fedora VM with Docker for running morloc code examples from docs.
#
# Prerequisites:
#   vagrant plugin install vagrant-libvirt
#
# Usage:
#   vagrant up                   # Start the VM
#   vagrant ssh fedora           # SSH into the VM
#   vagrant destroy -f           # Clean up

MORLOC_IMAGE = "ghcr.io/morloc-project/morloc/morloc-full:edge"
MORLOC_MANAGER_URL = "https://raw.githubusercontent.com/morloc-project/morloc-manager/refs/heads/main/morloc-manager.sh"

Vagrant.configure("2") do |config|
  config.vm.provider :libvirt do |lv|
    lv.memory = 4096
    lv.cpus = 2
    lv.machine_virtual_size = 60
  end

  config.vm.synced_folder ".", "/vagrant", type: "rsync",
    rsync__exclude: [".git/", "findings/"]

  config.vm.define "fedora" do |node|
    node.vm.box = "bento/fedora-40"
    node.vm.provision "shell", inline: <<-SHELL
      set -e

      # Install Docker
      dnf install -y dnf-plugins-core || true
      dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo 2>/dev/null || true
      dnf install -y docker-ce docker-ce-cli containerd.io || dnf install -y moby-engine
      systemctl enable --now docker

      # Add vagrant to docker group
      usermod -aG docker vagrant

      # Pull morloc container image
      docker pull #{MORLOC_IMAGE} || echo "WARNING: docker pull failed"

      # Install morloc-manager
      curl -o /usr/local/bin/morloc-manager #{MORLOC_MANAGER_URL}
      chmod +x /usr/local/bin/morloc-manager

      # Install morloc as the vagrant user
      su - vagrant -c "morloc-manager install"

      # Verify
      su - vagrant -c "morloc-manager run morloc --version" || echo "WARNING: morloc verification failed"
    SHELL
  end
end
