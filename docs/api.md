<img class="logo" src="../assets/logo/logo.min.png">


# Disfigure: API Reference



## Classes

Disfigure classes are used to define figures.

### new **Man**( )<br>new **Man**( *height* )

Class. Creates a man figure. The Optional parameter defines figure
*height* in meters. Default height 1.80.

### new **Woman**( )<br>new **Woman**( *height* )

Class. Creates a woman figure. The optional parameter defines figure
*height* in meters. Default height 1.70.

### new **Child**( )<br>new **Child**( *height* )

Class. Creates a child figure. The optional parameter defines figure
*height* in meters. Default height 1.35.



## Figures

Disfigure figures have the same structure independent on their appearance.

### figure.**position**

Vector3 property. Gets or sets the *position* of a figure in 3D space.

### figure.**position.x**<br>figure.**position.y**<br>figure.**position.z**

Numeric properties. Get or set the *x*, *y* or *z* coordinate of a figure in 3D space.

### figure.**posture**

Object property. Gets or sets the posture of a figure. The posture is a JavaScript object with specific structure.

### figure.**postureString**

String read-only property. Gets the posture of a figure as string.

### figure.**blend** ( *postureA*, *postureB*, *k* )

Method. Sets the posture of a *figure* to be a lerp blend of *postureA* and
*postureB* based on coefficient *k*&isin;[0,1].

### figure.***bodypart***

Body part properties. The *bodypart* is the name of a body part, one of these:
* Central body parts: **torso**, **head**, **chest**, **waist**
* Left leg: todo
* Right leg: todo
* Left arm: todo
* Right arm: todo
* Left palm: todo
* Right palm: todo



## Body parts

Each body part has the same set of properties, although some are deactivated.

### figure.bodypart.**x**

Numeric property. Gets or sets the rotation angle in degrees around the X
"shoulder" axis.

### figure.bodypart.**y**

Numeric property. Gets or sets the rotation angle in degrees around the Y
"head" axis.

### figure.bodypart.**z**

Numeric property. Gets or sets the rotation angle in degrees around the Z
"chest" axis.



<div class="footnote">
	<a href="../">Home</a> &middot;
	<a href="https://github.com/boytchev/disfigure">GitHub</a> &middot; 
	<a href="https://www.npmjs.com/package/disfigure">Legacy NPM</a>
</div>