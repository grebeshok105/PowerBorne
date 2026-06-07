#version 150

uniform sampler2D DiffuseSampler;
uniform vec4 ColorModulate;
uniform float ColorStrength;

in vec2 texCoord;
out vec4 fragColor;

void main() {
    vec4 color = texture(DiffuseSampler, texCoord);
    vec4 modulated = color * ColorModulate;
    fragColor = mix(color, modulated, ColorStrength);
}